import { useEffect, useState } from 'react';
import Auth from './components/auth';
import AdminPanel from './components/AdminPanel';
import { ACHIEVEMENTS, calculateStats } from './utils/gamelogics';
import './App.css';

function loadUsers() {
  try {
    const users = JSON.parse(localStorage.getItem('app_users') || '[]');
    return Array.isArray(users) ? users : [];
  } catch {
    return [];
  }
}

function loadClasses() {
  try {
    const classes = JSON.parse(localStorage.getItem('app_classes') || '[]');
    return Array.isArray(classes) ? classes : [];
  } catch {
    return [];
  }
}

function saveClasses(classes) {
  localStorage.setItem('app_classes', JSON.stringify(classes));
}

function createClassCode() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code = 'LB-';
  for (let i = 0; i < 6; i += 1) {
    code += chars[Math.floor(Math.random() * chars.length)];
  }
  return code;
}

function App() {
  const [user, setUser] = useState(null);
  const [page, setPage] = useState('home');
  const [notice, setNotice] = useState('');
  const [className, setClassName] = useState('');
  const [joinCode, setJoinCode] = useState('');
  const [form, setForm] = useState({
    book: '',
    pages: '',
    minutes: '',
    summary: '',
  });

  useEffect(() => {
    const savedId = localStorage.getItem('lebem_session');
    if (!savedId) return;

    const savedUser = loadUsers().find((u) => u.id === savedId);
    if (savedUser) setUser(savedUser);
  }, []);

  function saveUser(updatedUser) {
    const users = loadUsers().map((u) =>
      u.id === updatedUser.id ? updatedUser : u
    );
    localStorage.setItem('app_users', JSON.stringify(users));
    setUser(updatedUser);
  }

  function login(selectedUser) {
    setUser(selectedUser);
    localStorage.setItem('lebem_session', selectedUser.id);
    setPage('home');
  }

  function logout() {
    localStorage.removeItem('lebem_session');
    setUser(null);
    setPage('home');
  }

  function createClass(e) {
    e.preventDefault();
    const name = className.trim();

    if (!name) {
      setNotice('Digite o nome da turma.');
      return;
    }

    const classes = loadClasses();
    let code = createClassCode();
    while (classes.some((item) => item.code === code)) {
      code = createClassCode();
    }

    const newClass = {
      id: crypto.randomUUID(),
      name,
      code,
      teacherId: user.id,
      studentIds: [],
      createdAt: new Date().toISOString(),
    };

    saveClasses([...classes, newClass]);
    setClassName('');
    setNotice(`Turma criada! Código de convite: ${code}`);
  }

  function joinClass(e) {
    e.preventDefault();
    const code = joinCode.trim().toUpperCase();

    if (!code) {
      setNotice('Digite o código da turma.');
      return;
    }

    const classes = loadClasses();
    const target = classes.find((item) => item.code === code);

    if (!target) {
      setNotice('Código não encontrado. Confira com seu professor.');
      return;
    }

    if ((target.studentIds || []).includes(user.id)) {
      setNotice(`Você já participa da turma ${target.name}.`);
      return;
    }

    const updatedClasses = classes.map((item) =>
      item.id === target.id
        ? { ...item, studentIds: [...(item.studentIds || []), user.id] }
        : item
    );

    saveClasses(updatedClasses);
    setJoinCode('');
    setNotice(`Você entrou na turma ${target.name}!`);
  }

  function registerReading(e) {
    e.preventDefault();

    const pages = Number(form.pages);
    const minutes = Number(form.minutes);
    const summary = form.summary.trim();

    if (
      !form.book.trim() ||
      !Number.isInteger(pages) ||
      pages < 1 ||
      !Number.isFinite(minutes) ||
      minutes < 1 ||
      !summary
    ) {
      setNotice('Preencha todos os campos com valores válidos.');
      return;
    }

    const session = {
      id: crypto.randomUUID(),
      book: form.book.trim(),
      pages,
      minutes,
      summary,
      timestamp: new Date().toISOString(),
    };

    const logs = [...(user.logs || []), session];
    const stats = calculateStats(logs);
    const unlocked = new Set(user.achievements || []);
    const newlyUnlocked = [];

    ACHIEVEMENTS.forEach((achievement) => {
      if (
        !unlocked.has(achievement.id) &&
        achievement.check(stats, session)
      ) {
        unlocked.add(achievement.id);
        newlyUnlocked.push(achievement);
      }
    });

    const earnedXP =
      pages * 2 +
      Math.min(minutes, 120) +
      newlyUnlocked.reduce((total, item) => total + item.xp, 0);

    const updatedUser = {
      ...user,
      logs,
      achievements: [...unlocked],
      xp: (user.xp || 0) + earnedXP,
    };

    saveUser(updatedUser);
    setForm({ book: '', pages: '', minutes: '', summary: '' });
    setNotice(
      newlyUnlocked.length
        ? `🎉 Nova conquista: ${newlyUnlocked.map((a) => a.title).join(', ')}! Você ganhou ${earnedXP} XP.`
        : `Leitura registrada! Você ganhou ${earnedXP} XP.`
    );
    setPage('home');
  }

  if (!user) return <Auth onLogin={login} />;

  if (user.isAdmin) {
    return (
      <div className="app-shell">
        <header className="topbar">
          <button className="brand" onClick={() => setPage('home')}>
            📚 LêBem
          </button>
          <span className="role-chip">Administrador</span>
          <button className="outline-button" onClick={logout}>Sair</button>
        </header>
        <main className="dashboard">
          <AdminPanel />
          <footer className="app-footer">LêBem · Cada página é uma conquista. 💚</footer>
        </main>
      </div>
    );
  }

  const isTeacher = user.role === 'teacher';

  if (isTeacher) {
    const teacherClasses = loadClasses().filter((item) => item.teacherId === user.id);
    const enrolledStudentIds = new Set(teacherClasses.flatMap((item) => item.studentIds || []));
    const students = loadUsers().filter(
      (u) => u.role === 'student' && enrolledStudentIds.has(u.id)
    );
    const allLogs = students.flatMap((student) =>
      (student.logs || []).map((log) => ({
        ...log,
        studentName: student.username,
      }))
    );

    const totalPages = allLogs.reduce((sum, log) => sum + log.pages, 0);
    const totalMinutes = allLogs.reduce((sum, log) => sum + log.minutes, 0);
    const totalAchievements = students.reduce(
      (sum, student) => sum + (student.achievements || []).length,
      0
    );
    const maxPages = Math.max(
      1,
      ...students.map((student) =>
        (student.logs || []).reduce((sum, log) => sum + log.pages, 0)
      )
    );

    return (
      <div className="app-shell">
        <header className="topbar">
          <button className="brand" onClick={() => setPage('home')}>
            📚📖 LêBem
          </button>
          <span className="role-chip">Área do professor</span>
          <button className="outline-button" onClick={logout}>Sair</button>
        </header>

        <main className="dashboard">
          <p className="eyebrow">PAINEL PEDAGÓGICO</p>
          <h1>Olá, professor! 👋</h1>
          <p className="muted">Acompanhe a jornada de leitura dos seus alunos.</p>

          <section className="panel">
            <h2>Minhas turmas</h2>
            <form className="reading-form" onSubmit={createClass}>
              <label htmlFor="class-name">Nome da nova turma</label>
              <input
                id="class-name"
                value={className}
                onChange={(e) => setClassName(e.target.value)}
                placeholder="Ex.: 3º Ano A"
                maxLength={60}
                required
              />
              <button className="primary-button" type="submit">Criar turma e gerar código</button>
            </form>

            {teacherClasses.length === 0 ? (
              <p className="empty-state">Você ainda não criou turmas. Crie uma para gerar seu primeiro código de convite.</p>
            ) : (
              <div className="student-list">
                {teacherClasses.map((item) => (
                  <article className="student-card" key={item.id}>
                    <div className="student-heading">
                      <div className="avatar">📚</div>
                      <div className="student-name">
                        <strong>{item.name}</strong>
                        <span>{(item.studentIds || []).length} aluno(s) matriculado(s)</span>
                      </div>
                    </div>
                    <p><strong>Código de convite:</strong> <code>{item.code}</code></p>
                    <button
                      className="outline-button"
                      type="button"
                      onClick={() => {
                        if (navigator.clipboard?.writeText) {
                          navigator.clipboard.writeText(item.code)
                            .then(() => setNotice(`Código ${item.code} copiado!`))
                            .catch(() => setNotice(`Código da turma: ${item.code}`));
                        } else {
                          setNotice(`Código da turma: ${item.code}`);
                        }
                      }}
                    >
                      Copiar código
                    </button>
                  </article>
                ))}
              </div>
            )}
          </section>

          <section className="stats-grid">
            <Stat title="Alunos cadastrados" value={students.length} icon="👩‍🎓" />
            <Stat title="Páginas lidas" value={totalPages} icon="📖" />
            <Stat title="Tempo de leitura" value={`${totalMinutes} min`} icon="⏱️" />
            <Stat title="Medalhas conquistadas" value={totalAchievements} icon="🏆" />
          </section>

          <section className="panel">
            <h2>Desempenho por aluno</h2>
            {students.length === 0 ? (
              <p className="empty-state">
                Ainda não há alunos cadastrados neste navegador.
              </p>
            ) : (
              <div className="student-list">
                {students.map((student) => {
                  const stats = calculateStats(student.logs || []);
                  const studentXP = student.xp || 0;

                  return (
                    <article className="student-card" key={student.id}>
                      <div className="student-heading">
                        <div className="avatar">{student.username.charAt(0).toUpperCase()}</div>
                        <div className="student-name">
                          <strong>{student.username}</strong>
                          <span>{stats.totalSessions} sessões de leitura</span>
                        </div>
                        <span className="xp-label">⭐ {studentXP} XP</span>
                      </div>

                      <div className="progress-track">
                        <div
                          className="progress-fill"
                          style={{ width: `${Math.min(100, (stats.totalPages / maxPages) * 100)}%` }}
                        />
                      </div>

                      <div className="student-metrics">
                        <span>📖 {stats.totalPages} páginas</span>
                        <span>⏱️ {stats.totalMinutes} minutos</span>
                        <span>🏅 {(student.achievements || []).length} medalhas</span>
                      </div>

                      {(student.logs || []).length > 0 && (
                        <details className="reading-details">
                          <summary>Ver registros e resumos</summary>
                          {[...(student.logs || [])].reverse().map((log) => (
                            <div className="log-item" key={log.id}>
                              <strong>{log.book}</strong>
                              <p>{log.pages} páginas · {log.minutes} minutos</p>
                              <p className="summary-text">{log.summary}</p>
                              <small>{new Date(log.timestamp).toLocaleString('pt-BR')}</small>
                            </div>
                          ))}
                        </details>
                      )}
                    </article>
                  );
                })}
              </div>
            )}
          </section>

          <section className="panel">
            <h2>Atividade de leitura recente</h2>
            {allLogs.length === 0 ? (
              <p className="muted">As leituras registradas aparecerão aqui.</p>
            ) : (
              <div className="log-list">
                {[...allLogs]
                  .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp))
                  .slice(0, 10)
                  .map((log) => (
                    <article className="log-item" key={log.id}>
                      <strong>{log.book}</strong>
                      <p>{log.studentName} · {log.pages} páginas · {log.minutes} min</p>
                      <p className="summary-text">{log.summary}</p>
                    </article>
                  ))}
              </div>
            )}
          </section>
          <p className="local-notice">
            Protótipo local: os dados deste painel são apenas os salvos neste navegador.
          </p>
        </main>
      </div>
    );
  }

  const logs = user.logs || [];
  const stats = calculateStats(logs);
  const earned = new Set(user.achievements || []);
  const nextLevelXP = 500;
  const level = Math.floor((user.xp || 0) / nextLevelXP) + 1;
  const levelProgress = ((user.xp || 0) % nextLevelXP) / nextLevelXP * 100;

  return (
    <div className="app-shell">
      <header className="topbar">
        <button className="brand" onClick={() => setPage('home')}>📚 LêBem</button>
        <nav className="main-nav">
          <button className={page === 'home' ? 'nav-active' : ''} onClick={() => setPage('home')}>Minha jornada</button>
          <button className={page === 'register' ? 'nav-active' : ''} onClick={() => { setNotice(''); setPage('register'); }}>Registrar leitura</button>
          <button className={page === 'medals' ? 'nav-active' : ''} onClick={() => setPage('medals')}>Conquistas</button>
        </nav>
        <button className="outline-button" onClick={logout}>Sair</button>
      </header>

      <main className="dashboard">
        {notice && (
          <div className="notice" role="status">
            <span>{notice}</span>
            <button onClick={() => setNotice('')} aria-label="Fechar aviso">×</button>
          </div>
        )}

        {page === 'home' && (
          <>
            <section className="welcome-banner">
              <div>
                <p className="eyebrow">SUA AVENTURA LITERÁRIA</p>
                <h1>Continue escrevendo sua história, {user.username}! ✨</h1>
                <p>Cada leitura é um passo para desbloquear um novo mundo.</p>
              </div>
              <div className="banner-book">📚</div>
            </section>

            <section className="panel">
              <h2>Entrar em uma turma</h2>
              <p className="muted">Peça o código ao seu professor e digite abaixo para vincular sua conta à turma.</p>
              <form className="reading-form" onSubmit={joinClass}>
                <label htmlFor="join-code">Código da turma</label>
                <input
                  id="join-code"
                  value={joinCode}
                  onChange={(e) => setJoinCode(e.target.value.toUpperCase())}
                  placeholder="Ex.: LB-X7K9M2"
                  maxLength={9}
                  autoCapitalize="characters"
                  required
                />
                <button className="primary-button" type="submit">Entrar na turma</button>
              </form>
              {loadClasses().filter((item) => (item.studentIds || []).includes(user.id)).length > 0 && (
                <p className="form-hint">
                  Suas turmas: {loadClasses()
                    .filter((item) => (item.studentIds || []).includes(user.id))
                    .map((item) => item.name)
                    .join(', ')}
                </p>
              )}
            </section>

            <section className="level-panel">
              <div className="level-icon">⭐</div>
              <div className="level-info">
                <strong>Nível {level} · Explorador de histórias</strong>
                <span>{user.xp || 0} XP · Faltam {nextLevelXP - ((user.xp || 0) % nextLevelXP)} XP para o próximo nível</span>
                <div className="progress-track"><div className="progress-fill" style={{ width: `${levelProgress}%` }} /></div>
              </div>
              <div className="streak-pill">🔥 {stats.currentStreak} dias ativos na semana</div>
            </section>

            <section className="stats-grid">
              <Stat title="Páginas lidas" value={stats.totalPages} icon="📖" />
              <Stat title="Tempo de leitura" value={`${stats.totalMinutes} min`} icon="⏱️" />
              <Stat title="Sessões concluídas" value={stats.totalSessions} icon="✅" />
              <Stat title="Medalhas" value={earned.size} icon="🏆" />
            </section>

            <section className="panel">
              <div className="section-heading">
                <div><p className="eyebrow">MAPA DA AVENTURA</p><h2>Sua trilha de leitura</h2></div>
                <button className="primary-button compact" onClick={() => { setNotice(''); setPage('register'); }}>+ Nova leitura</button>
              </div>
              <div className="journey-path">
                {[
                  { icon: '🌱', title: 'Começo da aventura', goal: 'Registrar sua primeira leitura', done: stats.totalSessions >= 1 },
                  { icon: '📚', title: 'Explorador de páginas', goal: 'Acumular 25 páginas', done: stats.totalPages >= 25 },
                  { icon: '🔥', title: 'Criando o hábito', goal: 'Ativar 3 dias da semana', done: stats.currentStreak >= 3 },
                  { icon: '🏆', title: 'Colecionador', goal: 'Desbloquear 3 medalhas', done: earned.size >= 3 },
                  { icon: '🌟', title: 'Centurião', goal: 'Ler 100 páginas', done: stats.totalPages >= 100 },
                ].map((step, index) => (
                  <div className={`journey-step ${step.done ? 'step-done' : ''}`} key={step.title}>
                    <div className="journey-node">{step.done ? '✓' : step.icon}</div>
                    <div className="journey-copy">
                      <span className="step-number">ETAPA {index + 1}</span>
                      <strong>{step.title}</strong>
                      <span>{step.goal}</span>
                    </div>
                    {step.done && <span className="done-tag">Concluída</span>}
                  </div>
                ))}
              </div>
            </section>

            <section className="panel">
              <div className="section-heading">
                <h2>Últimas leituras</h2>
                <button className="text-button" onClick={() => setPage('register')}>Registrar outra →</button>
              </div>
              {logs.length === 0 ? (
                <p className="empty-state">Sua história começa com a primeira página. Registre uma leitura para começar!</p>
              ) : (
                <div className="log-list">
                  {[...logs].reverse().slice(0, 5).map((log) => (
                    <article className="log-item" key={log.id}>
                      <strong>📘 {log.book}</strong>
                      <p>{log.pages} páginas · {log.minutes} minutos</p>
                      <p className="summary-text">{log.summary}</p>
                    </article>
                  ))}
                </div>
              )}
            </section>
          </>
        )}

        {page === 'register' && (
          <section className="panel form-panel">
            <p className="eyebrow">NOVA MISSÃO</p>
            <h1>Hora de registrar sua leitura! 📖</h1>
            <p className="muted">Registre o que leu e mostre o que ficou na sua memória.</p>
            <form className="reading-form" onSubmit={registerReading}>
              <label htmlFor="book">Nome do livro</label>
              <input id="book" value={form.book} onChange={(e) => setForm({ ...form, book: e.target.value })} placeholder="Ex.: O Pequeno Príncipe" required />

              <div className="form-row">
                <div>
                  <label htmlFor="pages">Páginas lidas</label>
                  <input id="pages" type="number" min="1" step="1" value={form.pages} onChange={(e) => setForm({ ...form, pages: e.target.value })} placeholder="Ex.: 15" required />
                </div>
                <div>
                  <label htmlFor="minutes">Tempo (minutos)</label>
                  <input id="minutes" type="number" min="1" step="1" value={form.minutes} onChange={(e) => setForm({ ...form, minutes: e.target.value })} placeholder="Ex.: 20" required />
                </div>
              </div>

              <label htmlFor="summary">O que você lembra da leitura?</label>
              <textarea id="summary" rows="6" value={form.summary} onChange={(e) => setForm({ ...form, summary: e.target.value })} placeholder="Conte com suas palavras o que aconteceu, quais personagens apareceram ou o que você aprendeu..." required />

              <p className="form-hint">💡 Escreva com suas próprias palavras. Seu resumo também será uma ferramenta para acompanhar sua compreensão.</p>
              <button className="primary-button" type="submit">Salvar leitura e receber XP ✨</button>
              <button className="text-button" type="button" onClick={() => setPage('home')}>Voltar à jornada</button>
            </form>
          </section>
        )}

        {page === 'medals' && (
          <>
            <section className="welcome-banner medal-banner">
              <div><p className="eyebrow">SUA COLEÇÃO</p><h1>Galeria de conquistas 🏆</h1><p>Continue lendo para desbloquear todas as medalhas!</p></div>
              <div className="banner-book">🥇</div>
            </section>
            <section className="stats-grid">
              <Stat title="Desbloqueadas" value={earned.size} icon="🏅" />
              <Stat title="Disponíveis" value={ACHIEVEMENTS.length - earned.size} icon="🔒" />
              <Stat title="XP acumulado" value={user.xp || 0} icon="⭐" />
              <Stat title="Páginas lidas" value={stats.totalPages} icon="📖" />
            </section>
            <section className="achievement-grid">
              {ACHIEVEMENTS.map((achievement) => {
                const unlocked = earned.has(achievement.id);
                return (
                  <article className={`achievement-card ${unlocked ? 'unlocked' : 'locked'}`} key={achievement.id}>
                    <div className="achievement-icon">{unlocked ? achievement.icon : '🔒'}</div>
                    <span className="rarity-label">{unlocked ? 'CONQUISTA DESBLOQUEADA' : 'AINDA BLOQUEADA'}</span>
                    <h3>{achievement.title}</h3>
                    <p>{achievement.description}</p>
                    <span className="achievement-xp">⭐ {achievement.xp} XP</span>
                  </article>
                );
              })}
            </section>
          </>
        )}
        <footer className="app-footer">LêBem · Cada página é uma conquista. 💚</footer>
      </main>
    </div>
  );
}

function Stat({ title, value, icon }) {
  return (
    <article className="stat-card">
      <div className="stat-icon">{icon}</div>
      <div><span>{title}</span><strong>{value}</strong></div>
    </article>
  );
}

export default App;
