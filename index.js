// backend/index.js
const express = require('express');
const cors = require('cors');
const Database = require('better-sqlite3');

const app = express();
app.use(cors());
app.use(express.json());

const db = new Database('data.db');

// Create habits table to store habit definitions
db.prepare(`
  CREATE TABLE IF NOT EXISTS habits (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    created_at TEXT NOT NULL
  )
`).run();

// Create checkins table to track daily habit completion
db.prepare(`
  CREATE TABLE IF NOT EXISTS checkins (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    habit_id INTEGER NOT NULL,
    date TEXT NOT NULL,
    checked_at TEXT NOT NULL,
    UNIQUE(habit_id, date)
  )
`).run();

/*
This function calculates a habit's streak by checking consecutive daily entries.
It starts from today; if today isn't checked but yesterday is, it starts from yesterday.
It counts backward until a missing day breaks the streak.
*/
function calculateStreak(habitId) {
  const rows = db.prepare(`
    SELECT date FROM checkins
    WHERE habit_id = ?
    ORDER BY date DESC
  `).all(habitId);

  const dates = new Set(rows.map(r => r.date));

  const today = new Date();
  let current = new Date(today);
  let streak = 0;

  const format = d => d.toISOString().slice(0, 10);

  if (!dates.has(format(today))) {
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);
    if (!dates.has(format(yesterday))) return 0;
    current = yesterday;
  }

  while (dates.has(format(current))) {
    streak++;
    current.setDate(current.getDate() - 1);
  }

  return streak;
}

// Create a new habit
app.post('/habits', (req, res) => {
  const name = req.body.name?.trim();
  if (!name) return res.status(400).json({ error: "name is required" });

  const created_at = new Date().toISOString();
  const result = db.prepare(`
    INSERT INTO habits (name, created_at)
    VALUES (?, ?)
  `).run(name, created_at);

  const habit = db.prepare(`SELECT * FROM habits WHERE id = ?`)
    .get(result.lastInsertRowid);

  res.status(201).json({ ...habit, streak: 0 });
});

// Get all habits with streaks
app.get('/habits', (req, res) => {
  const habits = db.prepare(`
    SELECT * FROM habits ORDER BY created_at ASC
  `).all();

  const result = habits.map(h => ({
    ...h,
    streak: calculateStreak(h.id)
  }));

  res.status(200).json(result);
});

// Check in a habit
app.post('/habits/:id/checkin', (req, res) => {
  const id = Number(req.params.id);
  const today = new Date().toISOString().slice(0, 10);
  const date = req.body.date || today;

  const habit = db.prepare(`SELECT * FROM habits WHERE id = ?`).get(id);
  if (!habit) return res.status(404).json({ error: "Habit not found" });

  try {
    const checked_at = new Date().toISOString();
    const result = db.prepare(`
      INSERT INTO checkins (habit_id, date, checked_at)
      VALUES (?, ?, ?)
    `).run(id, date, checked_at);

    const checkin = db.prepare(`SELECT * FROM checkins WHERE id = ?`)
      .get(result.lastInsertRowid);

    res.status(201).json({
      ...checkin,
      streak: calculateStreak(id)
    });
  } catch (err) {
    if (err.message.includes('UNIQUE')) {
      return res.status(409).json({ error: "Already checked in for this date" });
    }
    throw err;
  }
});

// Get checkins for a habit
app.get('/habits/:id/checkins', (req, res) => {
  const id = Number(req.params.id);

  const habit = db.prepare(`SELECT * FROM habits WHERE id = ?`).get(id);
  if (!habit) return res.status(404).json({ error: "Habit not found" });

  const rows = db.prepare(`
    SELECT date FROM checkins
    WHERE habit_id = ?
    ORDER BY date DESC
  `).all(id);

  res.status(200).json(rows.map(r => r.date));
});

// Delete a specific checkin
app.delete('/habits/:id/checkin/:date', (req, res) => {
  const id = Number(req.params.id);
  const date = req.params.date;

  db.prepare(`
    DELETE FROM checkins WHERE habit_id = ? AND date = ?
  `).run(id, date);

  res.status(200).json({ message: "Checkin removed" });
});

// Delete a habit and its checkins
app.delete('/habits/:id', (req, res) => {
  const id = Number(req.params.id);

  db.prepare(`DELETE FROM checkins WHERE habit_id = ?`).run(id);
  db.prepare(`DELETE FROM habits WHERE id = ?`).run(id);

  res.status(200).json({ message: `Habit ${id} and its checkins deleted` });
});

app.listen(5000, () => {
  console.log("Server running on http://localhost:5000");
});