
import { useEffect, useState } from 'react';
import axios from 'axios';

const API = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';

const client = axios.create({
  baseURL: API,
});

const authHeader = (token) => ({
  headers: {
    Authorization: `Bearer ${token}`,
  },
});

const prettyDate = (value) =>
  new Date(value).toLocaleDateString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });

export default function App() {
  const [token, setToken] = useState(
    () => localStorage.getItem('ht-token') || ''
  );

  const [user, setUser] = useState(() => {
    try {
      return JSON.parse(localStorage.getItem('ht-user') || 'null');
    } catch {
      localStorage.removeItem('ht-user');
      return null;
    }
  });

  const [mode, setMode] = useState('login');
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);
  const [pageLoading, setPageLoading] = useState(false);
  const [accountMenuOpen, setAccountMenuOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [editProfileOpen, setEditProfileOpen] = useState(false);
  const [theme, setTheme] = useState(() => localStorage.getItem('ht-theme') || 'light');
  const [toast, setToast] = useState('');
  const [profileForm, setProfileForm] = useState({
    fullName: user?.fullName || '',
    email: user?.email || '',
    username: user?.username || '',
  });

  useEffect(() => {
    localStorage.setItem('ht-theme', theme);
  }, [theme]);

  useEffect(() => {
    if (!toast) return;
    const timer = setTimeout(() => setToast(''), 3000);
    return () => clearTimeout(timer);
  }, [toast]);

  const [otpRequested, setOtpRequested] = useState(false);
  const [tab, setTab] = useState('overview');

  const [records, setRecords] = useState([]);
  const [reminders, setReminders] = useState([]);

  const [recordForm, setRecordForm] = useState({
    title: '',
    category: 'Blood test',
    recordDate: new Date().toISOString().slice(0, 10),
    notes: '',
  });

  const [reminderForm, setReminderForm] = useState({
    title: '',
    dueDate: '',
    recurrence: 'once',
  });

  const [files, setFiles] = useState([]);

  // Load user data after login
  useEffect(() => {
    if (token) {
      loadData();
    }
  }, [token]);

  // Fetch records and reminders
  async function loadData() {
    try {
      const [recordsResponse, remindersResponse] = await Promise.all([
        client.get('/records', authHeader(token)),
        client.get('/reminders', authHeader(token)),
      ]);

      setRecords(recordsResponse.data);
      setReminders(remindersResponse.data);
    } catch (error) {
      if (error.response?.status === 401) {
        logout();
      } else {
        setMessage(
          error.response?.data?.message ||
          'Could not load your data.'
        );
      }
    }
  }

  // Save login session and display loading animation
  function saveSession(data) {
    localStorage.setItem('ht-token', data.token);
    localStorage.setItem('ht-user', JSON.stringify(data.user));

    setToken(data.token);
    setUser(data.user);
    setProfileForm({
      fullName: data.user?.fullName || '',
      email: data.user?.email || '',
      username: data.user?.username || '',
    });
    setMessage('');
    setToast(`Welcome, ${data.user?.fullName?.split(' ')[0] || 'you'}! Login successful.`);
    setPageLoading(true);

    setTimeout(() => {
      setPageLoading(false);
    }, 2000);
  }

  // Request OTP
  async function requestOtp(e) {
    e.preventDefault();

    setBusy(true);
    setMessage('');

    try {
      const phone = e.currentTarget.form.phone.value;

      const { data } = await client.post('/auth/request-otp', {
        phone,
      });

      setOtpRequested(true);

      setMessage(
        data.devOtp
          ? `Development OTP: ${data.devOtp} (shown for local testing)`
          : data.message
      );
    } catch (error) {
      setMessage(
        error.response?.data?.message ||
        'OTP request failed. Is the backend running?'
      );
    } finally {
      setBusy(false);
    }
  }

  // Login or register
  async function submitAuth(e) {
    e.preventDefault();

    setBusy(true);
    setMessage('');

    const form = new FormData(e.currentTarget);
    const payload = Object.fromEntries(form.entries());

    try {
      const endpoint =
        mode === 'register'
          ? '/auth/register'
          : '/auth/login';

      const { data } = await client.post(
        endpoint,
        mode === 'register'
          ? payload
          : {
              login: payload.login,
              password: payload.password,
            }
      );

      saveSession(data);
    } catch (error) {
      setMessage(
        error.response?.data?.message ||
        'Request failed. Ensure the backend and MongoDB are running.'
      );
    } finally {
      setBusy(false);
    }
  }

  // Logout
  function logout() {
    setToast('You have been logged out successfully.');
    setAccountMenuOpen(false);
    setSettingsOpen(false);
    setEditProfileOpen(false);
    localStorage.removeItem('ht-token');
    localStorage.removeItem('ht-user');

    setToken('');
    setUser(null);

    setRecords([]);
    setReminders([]);

    setMode('login');
    setMessage('');

    setPageLoading(false);
    setTab('overview');
    setMessage('');
  }

  // Save profile locally and persist through the profile API if available.
  async function saveProfile(e) {
    e.preventDefault();
    setBusy(true);
    try {
      const { data } = await client.put('/auth/profile', profileForm, authHeader(token));
      const updatedUser = data.user || { ...user, ...profileForm };
      localStorage.setItem('ht-user', JSON.stringify(updatedUser));
      setUser(updatedUser);
      setProfileForm({
        fullName: updatedUser.fullName || '',
        email: updatedUser.email || '',
        username: updatedUser.username || '',
      });
      setEditProfileOpen(false);
      setToast('Profile updated successfully.');
    } catch (error) {
      setToast(error.response?.data?.message || 'Could not update profile. Make sure PUT /auth/profile is supported by your backend.');
    } finally {
      setBusy(false);
    }
  }

  // Navigate to dashboard tabs with 2-second loading
  function navigateToTab(newTab) {
    if (newTab === tab || pageLoading) {
      return;
    }

    setPageLoading(true);

    setTimeout(() => {
      setTab(newTab);
      setPageLoading(false);
    }, 2000);
  }

  // Add health record
  async function addRecord(e) {
    e.preventDefault();

    setBusy(true);
    setMessage('');

    const body = new FormData();

    Object.entries(recordForm).forEach(([key, value]) => {
      body.append(key, value);
    });

    files.forEach((file) => {
      body.append('attachments', file);
    });

    try {
      await client.post('/records', body, {
        ...authHeader(token),
        headers: {
          ...authHeader(token).headers,
          'Content-Type': 'multipart/form-data',
        },
      });

      setRecordForm({
        title: '',
        category: 'Blood test',
        recordDate: new Date().toISOString().slice(0, 10),
        notes: '',
      });

      setFiles([]);

      await loadData();

      setMessage('Health record saved.');
    } catch (error) {
      setMessage(
        error.response?.data?.message ||
        'Could not save record.'
      );
    } finally {
      setBusy(false);
    }
  }

  // Add reminder
  async function addReminder(e) {
    e.preventDefault();

    setBusy(true);
    setMessage('');

    try {
      await client.post(
        '/reminders',
        reminderForm,
        authHeader(token)
      );

      setReminderForm({
        title: '',
        dueDate: '',
        recurrence: 'once',
      });

      await loadData();

      setMessage('Reminder added.');
    } catch (error) {
      setMessage(
        error.response?.data?.message ||
        'Could not save reminder.'
      );
    } finally {
      setBusy(false);
    }
  }

  // Mark reminder complete
  async function completeReminder(id) {
    try {
      await client.patch(
        `/reminders/${id}/complete`,
        {},
        authHeader(token)
      );

      await loadData();
    } catch (error) {
      setMessage(
        error.response?.data?.message ||
        'Could not update reminder.'
      );
    }
  }

  // Delete health record
  async function deleteRecord(id) {
    try {
      await client.delete(
        `/records/${id}`,
        authHeader(token)
      );

      await loadData();
    } catch (error) {
      setMessage(
        error.response?.data?.message ||
        'Could not delete record.'
      );
    }
  }

  const pending = reminders.filter(
    (reminder) => !reminder.completed
  ).length;

  // Authentication page
  if (!token || !user) {
    return (
      <div className={`healthtrack-app theme-${theme}`}>
        {pageLoading && <LoadingScreen />}
        {toast && <div className="toast-message success" role="status"><span className="toast-icon">✓</span>{toast}</div>}

        <main className="auth-page">
          <section className="auth-intro">
            <div className="brand">
              <span className="brand-mark">+</span>
              HealthTrack
            </div>

            <h1>
              Your health,
              <br />
              <em>in one place.</em>
            </h1>

            <p>
              Keep track of checkups, lab reports, weight,
              and health reminders — all in one simple dashboard.
            </p>

            <div className="auth-points">
              <span>✓ Secure account</span>
              <span>✓ Personal health records</span>
              <span>✓ Recurring reminders</span>
            </div>
          </section>

          <section className="auth-card">
            <div className="switcher">
              <button
                className={mode === 'login' ? 'selected' : ''}
                onClick={() => {
                  setMode('login');
                  setMessage('');
                }}
              >
                Sign in
              </button>

              <button
                className={mode === 'register' ? 'selected' : ''}
                onClick={() => {
                  setMode('register');
                  setMessage('');
                }}
              >
                Create account
              </button>
            </div>

            <h2>
              {mode === 'register'
                ? 'Create your account'
                : 'Welcome back'}
            </h2>

            <p className="muted">
              {mode === 'register'
                ? 'Verify your mobile number to register.'
                : 'Sign in to view your health dashboard.'}
            </p>

            {message && (
              <div className="notice">
                {message}
              </div>
            )}

            <form
              onSubmit={submitAuth}
              className="form-stack"
            >
              {mode === 'register' ? (
                <>
                  <label>
                    Username
                    <input
                      name="username"
                      required
                      minLength="3"
                      maxLength="30"
                      pattern="[a-zA-Z0-9_.]+"
                      placeholder="e.g. aaditya"
                      autoComplete="username"
                    />
                  </label>

                  <label>
                    Full name
                    <input
                      name="fullName"
                      required
                      minLength="2"
                      placeholder="Your full name"
                      autoComplete="name"
                    />
                  </label>

                  <label>
                    Email address
                    <input
                      name="email"
                      required
                      type="email"
                      placeholder="you@example.com"
                      autoComplete="email"
                    />
                  </label>

                  <label>
                    Mobile number (international)

                    <div className="otp-row">
                      <input
                        name="phone"
                        type="tel"
                        required
                        pattern="[+][1-9][0-9]{7,14}"
                        placeholder="+97798XXXXXXXX"
                        autoComplete="tel"
                      />

                      <button
                        className="btn btn-light"
                        type="button"
                        disabled={busy}
                        onClick={requestOtp}
                      >
                        Send code
                      </button>
                    </div>
                  </label>

                  <label>
                    6-digit OTP
                    <input
                      name="otp"
                      required
                      inputMode="numeric"
                      pattern="[0-9]{6}"
                      maxLength="6"
                      placeholder="Enter verification code"
                    />
                  </label>
                </>
              ) : (
                <label>
                  Username or email
                  <input
                    name="login"
                    required
                    placeholder="Username or email"
                    autoComplete="username"
                  />
                </label>
              )}

              <label>
                Password
                <input
                  name="password"
                  required
                  type="password"
                  minLength="8"
                  placeholder={
                    mode === 'register'
                      ? '8+ characters, uppercase, lowercase, number'
                      : 'Your password'
                  }
                  autoComplete={
                    mode === 'register'
                      ? 'new-password'
                      : 'current-password'
                  }
                  pattern={
                    mode === 'register'
                      ? '(?=.*[a-z])(?=.*[A-Z])(?=.*\\d).{8,}'
                      : undefined
                  }
                />
              </label>

              <button
                className="btn btn-primary full"
                disabled={busy}
              >
                {busy
                  ? 'Please wait…'
                  : mode === 'register'
                    ? 'Create account'
                    : 'Sign in'}
              </button>
            </form>

            <p className="small-note">
              Local development OTP is displayed in the backend
              terminal or response. Real SMS requires Twilio
              Verify configuration.
            </p>
          </section>
        </main>
      </div>
    );
  }

  // Main dashboard
  return (
    <div className={`healthtrack-app theme-${theme}`}>
      {pageLoading && <LoadingScreen />}
      {toast && <div className="toast-message success" role="status"><span className="toast-icon">✓</span>{toast}</div>}

      <main className="app-shell">
        <aside className="sidebar">
          <div className="brand">
            <span className="brand-mark">+</span>
            HealthTrack
          </div>

          <div className="nav-label">
            WORKSPACE
          </div>

          {['overview', 'records', 'reminders'].map((item) => (
            <button
              key={item}
              className={`nav-item ${
                tab === item ? 'active' : ''
              }`}
              onClick={() => navigateToTab(item)}
              disabled={pageLoading}
            >
              <span>
                {item === 'overview'
                  ? '⌂'
                  : item === 'records'
                    ? '▤'
                    : '◷'}
              </span>

              {item[0].toUpperCase() + item.slice(1)}

              {item === 'reminders' && pending > 0 && (
                <b>{pending}</b>
              )}
            </button>
          ))}

          <div className="sidebar-bottom account-area">
            <button
              type="button"
              className="account-trigger"
              onClick={() => setAccountMenuOpen((open) => !open)}
              aria-expanded={accountMenuOpen}
              aria-label="Open account menu"
            >
              <span className="avatar">{user.fullName?.[0]?.toUpperCase() || 'U'}</span>
              <span className="account-name">
                <strong>{user.fullName}</strong>
                <small>@{user.username}</small>
              </span>
              <span className="account-chevron">⌄</span>
            </button>

            {accountMenuOpen && (
              <div className="account-dropdown">
                <button type="button" onClick={() => { setAccountMenuOpen(false); setSettingsOpen(true); }}>
                  <span>⚙</span> Settings
                </button>
                <button type="button" onClick={() => {
                  setProfileForm({
                    fullName: user.fullName || '',
                    email: user.email || '',
                    username: user.username || '',
                  });
                  setAccountMenuOpen(false);
                  setEditProfileOpen(true);
                }}>
                  <span>✎</span> Edit profile
                </button>
                <button type="button" className="dropdown-logout" onClick={logout}>
                  <span>⇥</span> Logout
                </button>
              </div>
            )}
          </div>
        </aside>

        <section className="main-content">
          <header className="topbar">
            <div>
              <span className="eyebrow">
                PERSONAL HEALTH
              </span>

              <h1>
                {tab === 'overview'
                  ? 'Overview'
                  : tab === 'records'
                    ? 'Health records'
                    : 'Checkups & reminders'}
              </h1>
            </div>

            <div className="date-pill">
              ◷{' '}
              {new Date().toLocaleDateString(undefined, {
                month: 'short',
                day: 'numeric',
                year: 'numeric',
              })}
            </div>
          </header>

          {message && (
            <div className="notice app-notice">
              {message}

              <button onClick={() => setMessage('')}>
                ×
              </button>
            </div>
          )}

          {/* OVERVIEW */}
          {tab === 'overview' && (
            <>
              <div className="welcome">
                <div>
                  <h2>
                    Hello, {user.fullName?.split(' ')[0]} 👋
                  </h2>

                  <p>
                    Here’s a snapshot of your health activity.
                  </p>
                </div>

                <div className="welcome-icon">
                  ✚
                </div>
              </div>

              <div className="stats-grid">
                <Stat
                  title="Health records"
                  value={records.length}
                  note="Reports and checkups"
                  icon="▤"
                />

                <Stat
                  title="Upcoming reminders"
                  value={pending}
                  note="Stay on top of checkups"
                  icon="◷"
                />

                <Stat
                  title="Checkups"
                  value={
                    records.filter(
                      (record) =>
                        record.category === 'Whole body checkup'
                    ).length
                  }
                  note="Whole body checkups"
                  icon="♡"
                />
              </div>

              <div className="content-grid">
                <section className="panel">
                  <div className="panel-head">
                    <div>
                      <h3>Recent health records</h3>
                      <p>Your latest saved reports</p>
                    </div>

                    <button
                      className="text-button"
                      onClick={() => navigateToTab('records')}
                    >
                      View all →
                    </button>
                  </div>

                  {records.length === 0 ? (
                    <Empty text="No records yet. Add your first health record." />
                  ) : (
                    <div className="record-list">
                      {records.slice(0, 4).map((record) => (
                        <RecordRow
                          key={record._id}
                          record={record}
                        />
                      ))}
                    </div>
                  )}
                </section>

                <section className="panel">
                  <div className="panel-head">
                    <div>
                      <h3>Upcoming reminders</h3>
                      <p>Planned checkups and tests</p>
                    </div>

                    <button
                      className="text-button"
                      onClick={() => navigateToTab('reminders')}
                    >
                      View all →
                    </button>
                  </div>

                  {reminders
                    .filter((reminder) => !reminder.completed)
                    .slice(0, 4)
                    .map((reminder) => (
                      <div
                        className="reminder-row"
                        key={reminder._id}
                      >
                        <span className="reminder-dot" />

                        <div>
                          <strong>{reminder.title}</strong>

                          <small>
                            {prettyDate(reminder.dueDate)} ·{' '}
                            {reminder.recurrence === '6months'
                              ? 'Every 6 months'
                              : reminder.recurrence === 'yearly'
                                ? 'Every year'
                                : 'Once'}
                          </small>
                        </div>
                      </div>
                    ))}

                  {pending === 0 && (
                    <Empty text="No upcoming reminders." />
                  )}
                </section>
              </div>
            </>
          )}

          {/* RECORDS */}
          {tab === 'records' && (
            <div className="content-grid records-layout">
              <section className="panel">
                <div className="panel-head">
                  <div>
                    <h3>Add health record</h3>
                    <p>
                      Save checkups, blood tests, and reports
                    </p>
                  </div>
                </div>

                <form
                  className="form-stack"
                  onSubmit={addRecord}
                >
                  <label>
                    Record title
                    <input
                      value={recordForm.title}
                      onChange={(e) =>
                        setRecordForm({
                          ...recordForm,
                          title: e.target.value,
                        })
                      }
                      required
                      placeholder="e.g. Complete blood count"
                    />
                  </label>

                  <div className="two-col">
                    <label>
                      Category
                      <select
                        value={recordForm.category}
                        onChange={(e) =>
                          setRecordForm({
                            ...recordForm,
                            category: e.target.value,
                          })
                        }
                      >
                        <option>Blood test</option>
                        <option>Whole body checkup</option>
                        <option>Doctor visit</option>
                        <option>Other</option>
                      </select>
                    </label>

                    <label>
                      Date
                      <input
                        type="date"
                        value={recordForm.recordDate}
                        onChange={(e) =>
                          setRecordForm({
                            ...recordForm,
                            recordDate: e.target.value,
                          })
                        }
                        required
                      />
                    </label>
                  </div>

                  <label>
                    Notes
                    <textarea
                      rows="3"
                      value={recordForm.notes}
                      onChange={(e) =>
                        setRecordForm({
                          ...recordForm,
                          notes: e.target.value,
                        })
                      }
                      placeholder="Optional details"
                    />
                  </label>

                  <label>
                    Attachments (PDF, PNG, JPG · up to 8 MB each)
                    <input
                      type="file"
                      accept=".pdf,.png,.jpg,.jpeg"
                      multiple
                      onChange={(e) =>
                        setFiles(
                          Array.from(e.target.files || [])
                        )
                      }
                    />
                  </label>

                  {files.length > 0 && (
                    <p className="file-note">
                      {files.map((file) => file.name).join(', ')}
                    </p>
                  )}

                  <button
                    className="btn btn-primary"
                    disabled={busy}
                  >
                    {busy ? 'Saving…' : 'Save record'}
                  </button>
                </form>
              </section>

              <section className="panel">
                <div className="panel-head">
                  <div>
                    <h3>Saved records</h3>
                    <p>{records.length} total</p>
                  </div>
                </div>

                {records.length === 0 ? (
                  <Empty text="Your records will appear here." />
                ) : (
                  <div className="record-list">
                    {records.map((record) => (
                      <div
                        className="record-item"
                        key={record._id}
                      >
                        <RecordRow record={record} />

                        <button
                          className="delete-button"
                          onClick={() => deleteRecord(record._id)}
                        >
                          Delete
                        </button>

                        {record.attachments?.map(
                          (attachment, index) => (
                            <a
                              className="attachment"
                              key={index}
                              href={`${API.replace('/api', '')}${attachment.path}`}
                              target="_blank"
                              rel="noreferrer"
                            >
                              ↗ {attachment.name}
                            </a>
                          )
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </section>
            </div>
          )}

          {/* REMINDERS */}
          {tab === 'reminders' && (
            <div className="content-grid records-layout">
              <section className="panel">
                <div className="panel-head">
                  <div>
                    <h3>Create a reminder</h3>
                    <p>Schedule a test or checkup</p>
                  </div>
                </div>

                <form
                  className="form-stack"
                  onSubmit={addReminder}
                >
                  <label>
                    Reminder title
                    <input
                      value={reminderForm.title}
                      onChange={(e) =>
                        setReminderForm({
                          ...reminderForm,
                          title: e.target.value,
                        })
                      }
                      required
                      placeholder="e.g. Annual health checkup"
                    />
                  </label>

                  <label>
                    Due date
                    <input
                      type="date"
                      value={reminderForm.dueDate}
                      onChange={(e) =>
                        setReminderForm({
                          ...reminderForm,
                          dueDate: e.target.value,
                        })
                      }
                      required
                    />
                  </label>

                  <label>
                    Repeat
                    <select
                      value={reminderForm.recurrence}
                      onChange={(e) =>
                        setReminderForm({
                          ...reminderForm,
                          recurrence: e.target.value,
                        })
                      }
                    >
                      <option value="once">One time</option>
                      <option value="6months">Every 6 months</option>
                      <option value="yearly">Every year</option>
                    </select>
                  </label>

                  <button
                    className="btn btn-primary"
                    disabled={busy}
                  >
                    {busy ? 'Saving…' : 'Add reminder'}
                  </button>
                </form>
              </section>

              <section className="panel">
                <div className="panel-head">
                  <div>
                    <h3>Your reminders</h3>
                    <p>
                      Mark complete to schedule the next recurring date
                    </p>
                  </div>
                </div>

                {reminders.length === 0 ? (
                  <Empty text="No reminders scheduled yet." />
                ) : (
                  <div className="record-list">
                    {reminders.map((reminder) => (
                      <div
                        className="reminder-card"
                        key={reminder._id}
                      >
                        <div className="reminder-row">
                          <span
                            className={`reminder-dot ${
                              reminder.completed ? 'done' : ''
                            }`}
                          />

                          <div>
                            <strong>{reminder.title}</strong>

                            <small>
                              {prettyDate(reminder.dueDate)} ·{' '}
                              {reminder.recurrence === '6months'
                                ? 'Every 6 months'
                                : reminder.recurrence === 'yearly'
                                  ? 'Every year'
                                  : 'One time'}

                              {reminder.completed
                                ? ' · Completed'
                                : ''}
                            </small>
                          </div>
                        </div>

                        {!reminder.completed && (
                          <button
                            className="btn btn-light btn-small"
                            onClick={() =>
                              completeReminder(reminder._id)
                            }
                          >
                            Mark complete
                          </button>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </section>
            </div>
          )}

          <footer>
            HealthTrack · Keep your health information organized.
          </footer>
        </section>
      </main>

      {settingsOpen && (
        <div className="modal-backdrop" onClick={() => setSettingsOpen(false)}>
          <section className="modal-card" role="dialog" aria-modal="true" aria-labelledby="settings-title" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <div><h2 id="settings-title">Settings</h2><p>Personalize your HealthTrack experience.</p></div>
              <button type="button" className="modal-close" onClick={() => setSettingsOpen(false)} aria-label="Close settings">×</button>
            </div>
            <div className="settings-row">
              <div><strong>Appearance</strong><p>Choose light or dark mode.</p></div>
              <div className="theme-options">
                <button type="button" className={theme === 'light' ? 'selected' : ''} onClick={() => setTheme('light')}>☀ Light</button>
                <button type="button" className={theme === 'dark' ? 'selected' : ''} onClick={() => setTheme('dark')}>☾ Dark</button>
              </div>
            </div>
            <button type="button" className="btn btn-light full" onClick={() => setSettingsOpen(false)}>Done</button>
          </section>
        </div>
      )}

      {editProfileOpen && (
        <div className="modal-backdrop" onClick={() => setEditProfileOpen(false)}>
          <section className="modal-card" role="dialog" aria-modal="true" aria-labelledby="profile-title" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <div><h2 id="profile-title">Edit profile</h2><p>Update your account details.</p></div>
              <button type="button" className="modal-close" onClick={() => setEditProfileOpen(false)} aria-label="Close profile">×</button>
            </div>
            <form className="form-stack" onSubmit={saveProfile}>
              <label>Full name<input value={profileForm.fullName} onChange={(e) => setProfileForm({ ...profileForm, fullName: e.target.value })} required /></label>
              <label>Email address<input type="email" value={profileForm.email} onChange={(e) => setProfileForm({ ...profileForm, email: e.target.value })} required /></label>
              <label>Username<input value={profileForm.username} onChange={(e) => setProfileForm({ ...profileForm, username: e.target.value })} required minLength="3" /></label>
              <button className="btn btn-primary full" disabled={busy}>{busy ? 'Saving…' : 'Save changes'}</button>
            </form>
          </section>
        </div>
      )}
    </div>
  );
}

// Loading animation
function LoadingScreen() {
  return (
    <div className="loading-overlay">
      <div className="loading-content">
        <div className="loading-spinner"></div>

        <h2>HealthTrack</h2>

        <p>Loading your health dashboard...</p>
      </div>
    </div>
  );
}

// Dashboard stat card
function Stat({ title, value, note, icon }) {
  return (
    <div className="stat-card">
      <div className="stat-top">
        <span>{title}</span>
        <span className="stat-icon">{icon}</span>
      </div>

      <strong>{value}</strong>

      <small>{note}</small>
    </div>
  );
}

// Health record row
function RecordRow({ record }) {
  return (
    <div className="record-row">
      <span className="record-icon">▤</span>

      <div>
        <strong>{record.title}</strong>

        <small>
          {record.category} · {prettyDate(record.recordDate)}
        </small>
      </div>
    </div>
  );
}

// Empty state
function Empty({ text }) {
  return (
    <div className="empty-state">
      <span>◌</span>
      <p>{text}</p>
    </div>
  );
}
