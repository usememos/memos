package mysql

import (
	"context"
	"database/sql"
	"strings"

	"github.com/pkg/errors"
	"github.com/usememos/memos/store"
)

const mysqlHabitFields = "id, uid, creator_id, created_ts, updated_ts, title, identity, cue, environment, minimum_value, target_value, start_date"

func (d *DB) CreateHabit(ctx context.Context, create *store.Habit) (*store.Habit, error) {
	tx, err := d.db.BeginTx(ctx, nil)
	if err != nil {
		return nil, errors.Wrap(err, "failed to begin create habit transaction")
	}
	defer func() { _ = tx.Rollback() }()
	var creatorID int32
	if err := tx.QueryRowContext(ctx, "SELECT id FROM user WHERE id = ? AND row_status = 'NORMAL' FOR SHARE", create.CreatorID).Scan(&creatorID); err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return nil, errors.Wrap(err, "habit creator not found")
		}
		return nil, errors.Wrap(err, "failed to lock habit creator")
	}
	result, err := tx.ExecContext(ctx, `INSERT INTO habit (uid, creator_id, title, identity, cue, environment, minimum_value, target_value, start_date) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`, create.UID, creatorID, create.Title, create.Identity, create.Cue, create.Environment, create.MinimumValue, create.TargetValue, create.StartDate)
	if err != nil {
		return nil, errors.Wrap(err, "failed to create habit")
	}
	id, err := result.LastInsertId()
	if err != nil {
		return nil, err
	}
	habitID := int32(id)
	habit := &store.Habit{}
	if err := tx.QueryRowContext(ctx, "SELECT "+mysqlHabitFields+" FROM habit WHERE id = ?", habitID).Scan(habitScanTargets(habit)...); err != nil {
		return nil, errors.Wrap(err, "failed to read created habit")
	}
	if err := tx.Commit(); err != nil {
		return nil, errors.Wrap(err, "failed to commit create habit transaction")
	}
	return habit, nil
}

func (d *DB) ListHabits(ctx context.Context, find *store.FindHabit) ([]*store.Habit, error) {
	where, args := []string{"1 = 1"}, []any{}
	if find.ID != nil {
		where, args = append(where, "id = ?"), append(args, *find.ID)
	}
	if find.UID != nil {
		where, args = append(where, "uid = ?"), append(args, *find.UID)
	}
	if find.CreatorID != nil {
		where, args = append(where, "creator_id = ?"), append(args, *find.CreatorID)
	}
	rows, err := d.db.QueryContext(ctx, "SELECT "+mysqlHabitFields+" FROM habit WHERE "+strings.Join(where, " AND ")+" ORDER BY id ASC", args...)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	list := []*store.Habit{}
	for rows.Next() {
		habit := &store.Habit{}
		if err := rows.Scan(habitScanTargets(habit)...); err != nil {
			return nil, err
		}
		list = append(list, habit)
	}
	return list, rows.Err()
}

func (d *DB) UpdateHabit(ctx context.Context, update *store.UpdateHabit) (*store.Habit, error) {
	sets, args := []string{}, []any{}
	add := func(name string, value any) { sets, args = append(sets, name+" = ?"), append(args, value) }
	if update.Title != nil {
		add("title", *update.Title)
	}
	if update.Identity != nil {
		add("identity", *update.Identity)
	}
	if update.Cue != nil {
		add("cue", *update.Cue)
	}
	if update.Environment != nil {
		add("environment", *update.Environment)
	}
	if update.MinimumValue != nil {
		add("minimum_value", *update.MinimumValue)
	}
	if update.TargetValue != nil {
		add("target_value", *update.TargetValue)
	}
	if update.StartDate != nil {
		add("start_date", *update.StartDate)
	}
	if len(sets) > 0 {
		sets = append(sets, "updated_ts = UNIX_TIMESTAMP()")
		args = append(args, update.ID, update.CreatorID)
		if _, err := d.db.ExecContext(ctx, "UPDATE habit SET "+strings.Join(sets, ", ")+" WHERE id = ? AND creator_id = ?", args...); err != nil {
			return nil, err
		}
	}
	list, err := d.ListHabits(ctx, &store.FindHabit{ID: &update.ID, CreatorID: &update.CreatorID})
	if err != nil || len(list) == 0 {
		return nil, err
	}
	return list[0], nil
}

func (d *DB) DeleteHabit(ctx context.Context, delete *store.DeleteHabit) error {
	_, err := d.db.ExecContext(ctx, "DELETE FROM habit WHERE id = ? AND creator_id = ?", delete.ID, delete.CreatorID)
	return err
}

func (d *DB) UpsertHabitLog(ctx context.Context, upsert *store.HabitLog) (*store.HabitLog, error) {
	_, err := d.db.ExecContext(ctx, `INSERT INTO habit_log (habit_id, log_date, value)
		SELECT ?, ?, ? FROM habit WHERE id = ?
		ON DUPLICATE KEY UPDATE value = VALUES(value), updated_ts = UNIX_TIMESTAMP()`, upsert.HabitID, upsert.LogDate, upsert.Value, upsert.HabitID)
	if err != nil {
		return nil, err
	}
	log := &store.HabitLog{}
	err = d.db.QueryRowContext(ctx, "SELECT habit_id, log_date, value, created_ts, updated_ts FROM habit_log WHERE habit_id = ? AND log_date = ?", upsert.HabitID, upsert.LogDate).Scan(&log.HabitID, &log.LogDate, &log.Value, &log.CreatedTs, &log.UpdatedTs)
	return log, err
}

func (d *DB) ListHabitLogs(ctx context.Context, find *store.FindHabitLog) ([]*store.HabitLog, error) {
	where, args := []string{"1 = 1"}, []any{}
	if find.HabitID != nil {
		where, args = append(where, "habit_id = ?"), append(args, *find.HabitID)
	}
	if find.StartDate != nil {
		where, args = append(where, "log_date >= ?"), append(args, *find.StartDate)
	}
	if find.EndDate != nil {
		where, args = append(where, "log_date <= ?"), append(args, *find.EndDate)
	}
	rows, err := d.db.QueryContext(ctx, "SELECT habit_id, log_date, value, created_ts, updated_ts FROM habit_log WHERE "+strings.Join(where, " AND ")+" ORDER BY log_date ASC", args...)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	list := []*store.HabitLog{}
	for rows.Next() {
		log := &store.HabitLog{}
		if err := rows.Scan(&log.HabitID, &log.LogDate, &log.Value, &log.CreatedTs, &log.UpdatedTs); err != nil {
			return nil, err
		}
		list = append(list, log)
	}
	return list, rows.Err()
}
func (d *DB) DeleteHabitLog(ctx context.Context, delete *store.DeleteHabitLog) error {
	_, err := d.db.ExecContext(ctx, "DELETE FROM habit_log WHERE habit_id = ? AND log_date = ?", delete.HabitID, delete.LogDate)
	return err
}
func habitScanTargets(habit *store.Habit) []any {
	return []any{&habit.ID, &habit.UID, &habit.CreatorID, &habit.CreatedTs, &habit.UpdatedTs, &habit.Title, &habit.Identity, &habit.Cue, &habit.Environment, &habit.MinimumValue, &habit.TargetValue, &habit.StartDate}
}
