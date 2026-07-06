// frontend/src/App.jsx
import { useState, useEffect } from 'react';
import './App.css';

const API_URL = 'http://localhost:5000';

function App() {
  const [habits, setHabits] = useState([]);
  const [checkinsByHabit, setCheckinsByHabit] = useState({});
  const [newHabit, setNewHabit] = useState('');
  const [loading, setLoading] = useState(true);

  const getToday = () => new Date().toISOString().slice(0, 10);

  const refreshAll = async () => {
    try {
      const res = await fetch(`${API_URL}/habits`);
      const habitsData = await res.json();
      setHabits(habitsData);

      const checkinsObj = {};
      for (const h of habitsData) {
        const r = await fetch(`${API_URL}/habits/${h.id}/checkins`);
        checkinsObj[h.id] = await r.json();
      }
      setCheckinsByHabit(checkinsObj);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    refreshAll();
  }, []);

  const addHabit = async () => {
    const name = newHabit.trim();
    if (!name) return;

    try {
      await fetch(`${API_URL}/habits`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name })
      });
      setNewHabit('');
      refreshAll();
    } catch (err) {
      console.error(err);
    }
  };

  const checkIn = async (id) => {
    try {
      await fetch(`${API_URL}/habits/${id}/checkin`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({})
      });
      refreshAll();
    } catch (err) {
      console.error(err);
    }
  };

  const deleteHabit = async (id) => {
    try {
      await fetch(`${API_URL}/habits/${id}`, {
        method: 'DELETE'
      });
      refreshAll();
    } catch (err) {
      console.error(err);
    }
  };

  const getLast7Days = () => {
    const days = [];
    const d = new Date();
    for (let i = 0; i < 7; i++) {
      const temp = new Date(d);
      temp.setDate(d.getDate() - i);
      days.push(new Date(temp));
    }
    return days;
  };

  return (
    <div>
      <h1>🔥 Habit Tracker</h1>

      <div className="new-habit">
        <input
          value={newHabit}
          onChange={e => setNewHabit(e.target.value)}
          placeholder="e.g. Drink 2L water"
          onKeyDown={e => e.key === 'Enter' && addHabit()}
        />
        <button onClick={addHabit}>Add Habit</button>
      </div>

      {loading ? (
        <p>Loading your habits...</p>
      ) : habits.length === 0 ? (
        <p>No habits yet. Add one above to get started!</p>
      ) : (
        habits.map(h => {
          const dates = checkinsByHabit[h.id] || [];
          const today = getToday();
          const checkedToday = dates.includes(today);

          return (
            <div key={h.id} className="habit-card">
              <h3>{h.name}</h3>

              <p className="streak">
                {h.streak > 0
                  ? `🔥 ${h.streak} day streak`
                  : "No streak yet — check in today!"}
              </p>

              <button
                disabled={checkedToday}
                onClick={() => checkIn(h.id)}
                className={checkedToday ? 'checked' : ''}
              >
                {checkedToday ? '✅ Checked in today' : 'Check In'}
              </button>

              <div className="history">
                {getLast7Days().map((d, i) => {
                  const dateStr = d.toISOString().slice(0, 10);
                  const done = dates.includes(dateStr);
                  return (
                    <div key={i} className={done ? 'box done' : 'box'}>
                      {d.getDate()}
                    </div>
                  );
                })}
              </div>

              <button
                className="delete-btn"
                onClick={() => deleteHabit(h.id)}
              >
                Delete Habit
              </button>
            </div>
          );
        })
      )}
    </div>
  );
}

export default App;