package sqlite

import (
	"context"
	"strings"

	"github.com/pkg/errors"

	"github.com/usememos/memos/store"
)

const sqliteHabitFields = "id, uid, creator_id, created_ts, updated_ts, title, identity, cue, environment, minimum_value, target_value, start_date"

func (d *DB) CreateHabit(ctx context.Context, create *store.Habit) (*store.Habit, error) {
	habit := &store.Habit{}
	err := d.db.QueryRowContext(ctx, `INSERT INTO habit
		(uid, creator_id, title, identity, cue, environment, minimum_value, target_value, start_date)
		SELECT ?, id, ?, ?, ?, ?, ?, ?, ? FROM user WHERE id = ? AND row_status = 'NORMAL'
		RETURNING `+sqliteHabitFields,
		create.UID, create.Title, create.Identity, create.Cue, create.Environment, create.MinimumValue, create.TargetValue, create.StartDate, create.CreatorID,
	).Scan(habitScanTargets(habit)...)
	return habit, errors.Wrap(err, "failed to create habit")
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
	rows, err := d.db.QueryContext(ctx, "SELECT "+sqliteHabitFields+" FROM habit WHERE "+strings.Join(where, " AND ")+" ORDER BY id ASC", args...)
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
	appendField := func(name string, value any) { sets, args = append(sets, name+" = ?"), append(args, value) }
	if update.Title != nil {
		appendField("title", *update.Title)
	}
	if update.Identity != nil {
		appendField("identity", *update.Identity)
	}
	if update.Cue != nil {
		appendField("cue", *update.Cue)
	}
	if update.Environment != nil {
		appendField("environment", *update.Environment)
	}
	if update.MinimumValue != nil {
		appendField("minimum_value", *update.MinimumValue)
	}
	if update.TargetValue != nil {
		appendField("target_value", *update.TargetValue)
	}
	if update.StartDate != nil {
		appendField("start_date", *update.StartDate)
	}
	if len(sets) == 0 {
		list, err := d.ListHabits(ctx, &store.FindHabit{ID: &update.ID, CreatorID: &update.CreatorID})
		if err != nil || len(list) == 0 {
			return nil, err
		}
		return list[0], nil
	}
	sets = append(sets, "updated_ts = strftime('%s', 'now')")
	args = append(args, update.ID, update.CreatorID)
	habit := &store.Habit{}
	err := d.db.QueryRowContext(ctx, "UPDATE habit SET "+strings.Join(sets, ", ")+" WHERE id = ? AND creator_id = ? RETURNING "+sqliteHabitFields, args...).Scan(habitScanTargets(habit)...)
	return habit, errors.Wrap(err, "failed to update habit")
}

func (d *DB) DeleteHabit(ctx context.Context, delete *store.DeleteHabit) error {
	tx, err := d.db.BeginTx(ctx, nil)
	if err != nil {
		return err
	}
	defer func() { _ = tx.Rollback() }()
	if _, err := tx.ExecContext(ctx, "DELETE FROM habit_log WHERE habit_id IN (SELECT id FROM habit WHERE id = ? AND creator_id = ?)", delete.ID, delete.CreatorID); err != nil {
		return err
	}
	if _, err := tx.ExecContext(ctx, "DELETE FROM habit WHERE id = ? AND creator_id = ?", delete.ID, delete.CreatorID); err != nil {
		return err
	}
	return tx.Commit()
}

func (d *DB) UpsertHabitLog(ctx context.Context, upsert *store.HabitLog) (*store.HabitLog, error) {
	log := &store.HabitLog{}
	err := d.db.QueryRowContext(ctx, `INSERT INTO habit_log (habit_id, log_date, value)
		SELECT ?, ?, ? WHERE EXISTS (SELECT 1 FROM habit WHERE id = ?)
		ON CONFLICT(habit_id, log_date) DO UPDATE SET value = excluded.value, updated_ts = strftime('%s', 'now')
		RETURNING habit_id, log_date, value, created_ts, updated_ts`, upsert.HabitID, upsert.LogDate, upsert.Value, upsert.HabitID).
		Scan(&log.HabitID, &log.LogDate, &log.Value, &log.CreatedTs, &log.UpdatedTs)
	return log, errors.Wrap(err, "failed to upsert habit log")
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
