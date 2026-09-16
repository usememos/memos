package postgres

import (
	"context"
	"database/sql"
	"strings"

	"github.com/pkg/errors"
	"github.com/usememos/memos/store"
)

const postgresHabitFields = "id, uid, creator_id, created_ts, updated_ts, title, identity, cue, environment, minimum_value, target_value, start_date"

func (d *DB) CreateHabit(ctx context.Context, create *store.Habit) (*store.Habit, error) {
	tx, err := d.db.BeginTx(ctx, nil)
	if err != nil {
		return nil, errors.Wrap(err, "failed to begin create habit transaction")
	}
	defer func() { _ = tx.Rollback() }()
	var creatorID int32
	if err := tx.QueryRowContext(ctx, `SELECT id FROM "user" WHERE id = $1 AND row_status = 'NORMAL' FOR KEY SHARE`, create.CreatorID).Scan(&creatorID); err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return nil, errors.Wrap(err, "habit creator not found")
		}
		return nil, errors.Wrap(err, "failed to lock habit creator")
	}
	habit := &store.Habit{}
	if err := tx.QueryRowContext(ctx, `INSERT INTO habit (uid, creator_id, title, identity, cue, environment, minimum_value, target_value, start_date) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9) RETURNING `+postgresHabitFields, create.UID, creatorID, create.Title, create.Identity, create.Cue, create.Environment, create.MinimumValue, create.TargetValue, create.StartDate).Scan(habitScanTargets(habit)...); err != nil {
		return nil, errors.Wrap(err, "failed to create habit")
	}
	if err := tx.Commit(); err != nil {
		return nil, errors.Wrap(err, "failed to commit create habit transaction")
	}
	return habit, nil
}
func (d *DB) ListHabits(ctx context.Context, find *store.FindHabit) ([]*store.Habit, error) {
	where, args := []string{"1 = 1"}, []any{}
	add := func(field string, value any) {
		args = append(args, value)
		where = append(where, field+" = "+placeholder(len(args)))
	}
	if find.ID != nil {
		add("id", *find.ID)
	}
	if find.UID != nil {
		add("uid", *find.UID)
	}
	if find.CreatorID != nil {
		add("creator_id", *find.CreatorID)
	}
	rows, err := d.db.QueryContext(ctx, "SELECT "+postgresHabitFields+" FROM habit WHERE "+strings.Join(where, " AND ")+" ORDER BY id ASC", args...)
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
	add := func(name string, value any) {
		args = append(args, value)
		sets = append(sets, name+" = "+placeholder(len(args)))
	}
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
	if len(sets) == 0 {
		list, err := d.ListHabits(ctx, &store.FindHabit{ID: &update.ID, CreatorID: &update.CreatorID})
		if err != nil || len(list) == 0 {
			return nil, err
		}
		return list[0], nil
	}
	sets = append(sets, "updated_ts = EXTRACT(EPOCH FROM NOW())")
	args = append(args, update.ID, update.CreatorID)
	habit := &store.Habit{}
	err := d.db.QueryRowContext(ctx, "UPDATE habit SET "+strings.Join(sets, ", ")+" WHERE id = "+placeholder(len(args)-1)+" AND creator_id = "+placeholder(len(args))+" RETURNING "+postgresHabitFields, args...).Scan(habitScanTargets(habit)...)
	return habit, err
}
func (d *DB) DeleteHabit(ctx context.Context, delete *store.DeleteHabit) error {
	_, err := d.db.ExecContext(ctx, "DELETE FROM habit WHERE id = $1 AND creator_id = $2", delete.ID, delete.CreatorID)
	return err
}
func (d *DB) UpsertHabitLog(ctx context.Context, upsert *store.HabitLog) (*store.HabitLog, error) {
	log := &store.HabitLog{}
	err := d.db.QueryRowContext(ctx, `INSERT INTO habit_log (habit_id, log_date, value)
		SELECT $1, $2, $3 FROM habit WHERE id = $1
		ON CONFLICT(habit_id, log_date) DO UPDATE SET value = EXCLUDED.value, updated_ts = EXTRACT(EPOCH FROM NOW())
		RETURNING habit_id, log_date, value, created_ts, updated_ts`, upsert.HabitID, upsert.LogDate, upsert.Value).Scan(&log.HabitID, &log.LogDate, &log.Value, &log.CreatedTs, &log.UpdatedTs)
	return log, err
}
func (d *DB) ListHabitLogs(ctx context.Context, find *store.FindHabitLog) ([]*store.HabitLog, error) {
	where, args := []string{"1 = 1"}, []any{}
	add := func(field, op string, value any) {
		args = append(args, value)
		where = append(where, field+" "+op+" "+placeholder(len(args)))
	}
	if find.HabitID != nil {
		add("habit_id", "=", *find.HabitID)
	}
	if find.StartDate != nil {
		add("log_date", ">=", *find.StartDate)
	}
	if find.EndDate != nil {
		add("log_date", "<=", *find.EndDate)
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
	_, err := d.db.ExecContext(ctx, "DELETE FROM habit_log WHERE habit_id = $1 AND log_date = $2", delete.HabitID, delete.LogDate)
	return err
}
func habitScanTargets(habit *store.Habit) []any {
	return []any{&habit.ID, &habit.UID, &habit.CreatorID, &habit.CreatedTs, &habit.UpdatedTs, &habit.Title, &habit.Identity, &habit.Cue, &habit.Environment, &habit.MinimumValue, &habit.TargetValue, &habit.StartDate}
}
