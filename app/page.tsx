"use client";

import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";

type PageKey = "dashboard" | "project" | "workbench" | "review" | "payments" | "reports" | "settings";
type Priority = "未评估";
type Project = {
  id: string;
  name: string;
  website: string;
  mailbox: string;
  backend: string;
  status: "运行中" | "停用";
  gems: string;
  defaultGems: number;
  unread: number;
  connected: boolean;
};
type Mail = {
  id: string;
  project: string;
  mailboxId: "xjoy" | "kissly";
  sender: string;
  title: string;
  preview: string;
  original: string;
  html: string;
  priority: Priority;
  time: string;
  timestamp: number;
  unread: boolean;
  attachments: Array<{ filename: string; contentType: string; size: number }>;
};

type ApiMessage = {
  uid: string | number;
  mailboxId: "xjoy" | "kissly";
  projectId: "x-pink" | "kissly";
  from: string;
  subject: string;
  date: string;
  text: string;
  html: string;
  unread: boolean;
  attachments: Array<{ filename: string; contentType: string; size: number }>;
};

type MailboxResult = {
  id: "xjoy" | "kissly";
  projectId: "x-pink" | "kissly";
  address: string;
  connected: boolean;
  error?: string;
  messages: ApiMessage[];
};

const initialProjects: Project[] = [
  { id: "x-pink", name: "x.pink", website: "https://www.x.pink/", mailbox: "business@xjoy.ai", backend: "https://www.xjoy.ai/x-admin/#/", status: "运行中", gems: "Gems", defaultGems: 500, unread: 0, connected: false },
  { id: "kissly", name: "KISSLY", website: "https://www.kissly.ai/", mailbox: "business@kissly.ai", backend: "https://www.kissly.ai/x-admin/#/", status: "运行中", gems: "Gems", defaultGems: 500, unread: 0, connected: false },
];

const navItems: { key: PageKey; label: string }[] = [
  { key: "dashboard", label: "全部项目" },
  { key: "workbench", label: "邮件工作台" },
  { key: "review", label: "人工审核" },
  { key: "payments", label: "支付监控" },
  { key: "reports", label: "工作报告" },
  { key: "settings", label: "项目设置" },
];

export default function Home() {
  const [page, setPage] = useState<PageKey>("dashboard");
  const [projects, setProjects] = useState<Project[]>(initialProjects);
  const [activeProject, setActiveProject] = useState<string>("all");
  const [projectModal, setProjectModal] = useState<"add" | "edit" | null>(null);
  const [editingProject, setEditingProject] = useState<Project | null>(null);
  const [deleteProject, setDeleteProject] = useState<Project | null>(null);
  const [mails, setMails] = useState<Mail[]>([]);
  const [selectedMail, setSelectedMail] = useState("");
  const [search, setSearch] = useState("");
  const [mailLoading, setMailLoading] = useState(true);
  const [mailErrors, setMailErrors] = useState<Record<string, string>>({});
  const [refreshedAt, setRefreshedAt] = useState("");
  const [toast, setToast] = useState("");

  const currentProject = projects.find((item) => item.id === activeProject) || projects[0];
  const visibleMails = useMemo(() => mails.filter((mail) => {
    const projectMatch = activeProject === "all" || mail.project === activeProject;
    const needle = search.toLowerCase();
    const searchMatch = !needle || `${mail.title} ${mail.sender} ${mail.preview}`.toLowerCase().includes(needle);
    return projectMatch && searchMatch;
  }), [activeProject, mails, search]);
  const mail = mails.find((item) => item.id === selectedMail) || visibleMails[0] || null;

  const loadMail = useCallback(async () => {
    setMailLoading(true);
    try {
      const response = await fetch("/api/workbench/messages?mailbox=all&limit=20", { cache: "no-store" });
      const result = await response.json() as { mailboxes?: MailboxResult[]; refreshedAt?: string; error?: string };
      if (!response.ok || !result.mailboxes) throw new Error(result.error || "读取邮箱失败");

      const nextMails = result.mailboxes.flatMap((box) => box.messages.map((message) => {
        const date = new Date(message.date);
        const original = message.text?.trim() || "（该邮件没有纯文本正文）";
        return {
          id: `${box.id}:${message.uid}`,
          project: message.projectId,
          mailboxId: box.id,
          sender: message.from || "（发件人未知）",
          title: message.subject || "（无主题）",
          preview: original.replace(/\s+/g, " ").slice(0, 120),
          original,
          html: message.html || "",
          priority: "未评估" as const,
          time: Number.isNaN(date.getTime()) ? message.date : date.toLocaleString("zh-CN", { hour12: false }),
          timestamp: Number.isNaN(date.getTime()) ? 0 : date.getTime(),
          unread: message.unread,
          attachments: message.attachments || [],
        };
      })).sort((a, b) => b.timestamp - a.timestamp);

      setMails(nextMails);
      setSelectedMail((current) => nextMails.some((item) => item.id === current) ? current : (nextMails[0]?.id || ""));
      setMailErrors(Object.fromEntries(result.mailboxes.filter((box) => !box.connected).map((box) => [box.projectId, box.error || "连接失败"])));
      setProjects((items) => items.map((project) => {
        const box = result.mailboxes!.find((item) => item.projectId === project.id);
        return box ? { ...project, connected: box.connected, unread: box.messages.filter((message) => message.unread).length } : project;
      }));
      setRefreshedAt(result.refreshedAt || new Date().toISOString());
    } catch (error) {
      setMailErrors({ all: error instanceof Error ? error.message : "读取邮箱失败" });
    } finally {
      setMailLoading(false);
    }
  }, []);

  useEffect(() => { void loadMail(); }, [loadMail]);

  function notify(message: string) {
    setToast(message);
    window.setTimeout(() => setToast(""), 2200);
  }

  function openProject(project: Project) {
    setActiveProject(project.id);
    setPage("project");
  }

  function editProject(project: Project) {
    setEditingProject(project);
    setProjectModal("edit");
  }

  function removeProject() {
    if (!deleteProject) return;
    setProjects((items) => items.filter((item) => item.id !== deleteProject.id));
    if (activeProject === deleteProject.id) setActiveProject("all");
    setDeleteProject(null);
    notify("已停止监控，历史报告保留");
  }

  return (
    <div className="app-shell">
      <Sidebar page={page} activeProject={activeProject} currentProject={currentProject} onNavigate={setPage} />
      <main className="main-content">
        {page === "dashboard" && <Dashboard projects={projects} totalMessages={mails.length} loading={mailLoading} onAdd={() => { setEditingProject(null); setProjectModal("add"); }} onOpen={openProject} onEdit={editProject} onDelete={setDeleteProject} />}
        {page === "project" && <ProjectHome project={currentProject} mails={mails.filter((item) => item.project === currentProject.id)} error={mailErrors[currentProject.id]} onSwitch={(id) => { setActiveProject(id); }} projects={projects} onOpenMail={() => setPage("workbench")} />}
        {page === "workbench" && <Workbench projects={projects} activeProject={activeProject} onProject={setActiveProject} mails={visibleMails} mail={mail} onMail={setSelectedMail} search={search} onSearch={setSearch} loading={mailLoading} errors={mailErrors} refreshedAt={refreshedAt} onRefresh={loadMail} />}
        {page === "review" && <EmptyFeature title="人工审核中心" text="当前没有真实的待审核记录。提交真实回复或赔偿申请后才会显示在这里。" />}
        {page === "payments" && <PaymentMonitor projects={projects} activeProject={activeProject} onProject={setActiveProject} />}
        {page === "reports" && <EmptyFeature title="客服工作报告" text="当前没有真实的处理报告。系统不会再显示演示报告。" />}
        {page === "settings" && <ProjectSettings projects={projects} onAdd={() => { setEditingProject(null); setProjectModal("add"); }} onEdit={editProject} />}
      </main>

      {projectModal && <ProjectForm mode={projectModal} project={editingProject} onClose={() => setProjectModal(null)} onSave={(value) => {
        if (projectModal === "edit" && editingProject) {
          setProjects((items) => items.map((item) => item.id === editingProject.id ? { ...item, ...value } : item));
        } else {
          setProjects((items) => [...items, { ...value, id: `project-${Date.now()}`, unread: 0, connected: false }]);
        }
        setProjectModal(null);
        notify(projectModal === "edit" ? "项目设置已保存" : "新项目已添加");
      }} notify={notify} />}

      {deleteProject && <ConfirmModal project={deleteProject} onCancel={() => setDeleteProject(null)} onConfirm={removeProject} />}
      {toast && <div className="toast">{toast}</div>}
    </div>
  );
}

function Sidebar({ page, activeProject, currentProject, onNavigate }: { page: PageKey; activeProject: string; currentProject: Project; onNavigate: (page: PageKey) => void }) {
  return <aside className="sidebar">
    <div className="brand"><strong>AI 客服中心</strong><span>多项目客服中台 · V1.0</span></div>
    <nav>{navItems.map((item) => <button key={item.key} className={page === item.key ? "nav-active" : ""} onClick={() => onNavigate(item.key)}>{item.label}</button>)}</nav>
    <div className="sidebar-status"><strong>{activeProject === "all" ? "真实邮箱数据" : currentProject.mailbox}</strong><span><i className={currentProject.connected ? "" : "gray"} /> 邮箱{currentProject.connected ? "已连接" : "未连接"}</span><span><i className="gray" /> 项目后台未接入</span></div>
  </aside>;
}

function Header({ title, subtitle, action }: { title: string; subtitle: string; action?: React.ReactNode }) {
  return <header className="page-header"><div><h1>{title}</h1><p>{subtitle}</p></div>{action}</header>;
}

function Metric({ label, value, tag, tone = "neutral" }: { label: string; value: number | string; tag?: string; tone?: "neutral" | "red" | "amber" | "green" }) {
  return <div className="metric-card"><span>{label}</span><strong>{value}</strong>{tag && <em className={`pill ${tone}`}>{tag}</em>}</div>;
}

function Dashboard({ projects, totalMessages, loading, onAdd, onOpen, onEdit, onDelete }: { projects: Project[]; totalMessages: number; loading: boolean; onAdd: () => void; onOpen: (p: Project) => void; onEdit: (p: Project) => void; onDelete: (p: Project) => void }) {
  const unread = projects.reduce((sum, item) => sum + item.unread, 0);
  return <>
    <Header title="全部项目 Dashboard" subtitle="邮箱数据来自当前真实收件箱；项目后台数据尚未接入" action={<button className="primary" onClick={onAdd}>＋ 新增项目</button>} />
    <section className="metric-grid four"><Metric label="已加载邮件" value={loading ? "…" : totalMessages} tag={`${projects.length} 个邮箱`} /><Metric label="未读邮件" value={loading ? "…" : unread} /><Metric label="待审核回复" value={0} tag="真实记录" /><Metric label="待审核赔偿" value={0} tag="后台未接入" /></section>
    <section className="dashboard-columns">
      <div className="panel dashboard-fixed-panel"><div className="panel-title"><h2>项目管理</h2><span>共 {projects.length} 个项目</span></div><div className="project-scroll">
        {projects.map((project) => <article className="project-row" key={project.id}><div className="project-info"><h3>{project.name}</h3><a href={project.website} target="_blank">{project.website}</a><span>邮箱：{project.mailbox} · <b className="dot" /> {project.connected ? "已连接" : "连接失败"}</span><span>后台：{project.backend.replace("https://", "")} · <b className="dot" /> 未接入</span></div><span className={`pill ${project.connected ? "green" : "red"}`}>{project.unread} 封未读</span><div className="row-actions"><button className="primary" onClick={() => onOpen(project)}>进入管理</button><button onClick={() => onEdit(project)}>编辑</button><button className="danger" onClick={() => onDelete(project)}>删除</button></div></article>)}
      </div></div>
      <div className="panel dashboard-fixed-panel"><div className="panel-title"><h2>真实数据范围</h2></div><div className="issues-scroll"><div className="empty-state"><h3>邮箱已接入</h3><p>当前只展示真实邮件、发件人、主题、正文、时间、未读状态和附件元数据。</p><h3>项目后台未接入</h3><p>账号匹配、支付记录、到账状态、AI 分类和赔偿记录暂不生成结论。</p></div></div></div>
    </section>
  </>;
}

function ProjectForm({ mode, project, onClose, onSave, notify }: { mode: "add" | "edit"; project: Project | null; onClose: () => void; onSave: (project: Omit<Project, "id" | "unread" | "connected">) => void; notify: (s: string) => void }) {
  const [testingMailbox, setTestingMailbox] = useState(false);
  const isKissly = project?.mailbox === "business@kissly.ai";
  const defaultImapHost = isKissly ? "mail.emb666.com" : "imap.mailhostbox.com";
  const defaultSmtpHost = isKissly ? "mail.emb666.com" : "smtp.mailhostbox.com";

  function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const data = new FormData(e.currentTarget);
    onSave({ name: String(data.get("name")), website: String(data.get("website")), mailbox: String(data.get("mailbox")), backend: String(data.get("backend")), gems: String(data.get("gems")), defaultGems: Number(data.get("defaultGems")), status: String(data.get("status")) as "运行中" | "停用" });
  }

  async function testConnection(e: React.MouseEvent<HTMLButtonElement>) {
    const mailbox = String(new FormData(e.currentTarget.form!).get("mailbox") || "").toLowerCase();
    const mailboxId = mailbox === "business@xjoy.ai" ? "xjoy" : mailbox === "business@kissly.ai" ? "kissly" : null;
    if (!mailboxId) {
      notify("当前仅支持 business@xjoy.ai 和 business@kissly.ai");
      return;
    }

    setTestingMailbox(true);
    try {
      const response = await fetch(`/api/mailboxes/${mailboxId}/test`, { method: "POST" });
      const result = await response.json();
      notify(response.ok ? `${mailbox} 收信和发信连接正常` : result.error || "邮箱连接失败");
    } catch {
      notify("无法连接邮箱测试接口");
    } finally {
      setTestingMailbox(false);
    }
  }

  return <div className="modal-backdrop"><form className="modal large" onSubmit={submit}><div className="modal-title"><div><h2>{mode === "add" ? "新增项目" : "编辑项目"}</h2><p>每个项目独立配置客服邮箱与项目后台</p></div><button type="button" onClick={onClose}>关闭</button></div><div className="form-grid"><section><h3>基础信息</h3><label>项目名称<input name="name" required defaultValue={project?.name || ""} /></label><label>项目网站<input name="website" required defaultValue={project?.website || "https://"} /></label><label>项目状态<select name="status" defaultValue={project?.status || "运行中"}><option>运行中</option><option>停用</option></select></label><label>后台地址<input name="backend" required defaultValue={project?.backend || "https://"} /></label></section><section><h3>邮箱与赔偿设置</h3><label>客服邮箱<input name="mailbox" type="email" required defaultValue={project?.mailbox || ""} /></label><div className="split"><label>IMAP 服务器<input readOnly value={defaultImapHost} /></label><label>SMTP 服务器<input readOnly value={defaultSmtpHost} /></label></div><button type="button" disabled={testingMailbox} onClick={testConnection}>{testingMailbox ? "正在测试…" : "测试邮箱连接"}</button><label>宝石名称<input name="gems" required defaultValue={project?.gems || "Gems"} /></label><label>默认赔偿数量<input name="defaultGems" type="number" required defaultValue={project?.defaultGems || 500} /></label><button type="button" onClick={() => notify("尚未配置后台登录信息")}>测试后台登录</button></section></div><div className="modal-actions"><button type="button" onClick={onClose}>取消</button><button className="primary" type="submit">保存</button></div></form></div>;
}

function ConfirmModal({ project, onCancel, onConfirm }: { project: Project; onCancel: () => void; onConfirm: () => void }) {
  return <div className="modal-backdrop"><div className="modal confirm"><h2>确认删除？</h2><p>停止监控项目“{project.name}”，默认保留历史工作报告。</p><div className="modal-actions"><button onClick={onCancel}>取消</button><button className="danger solid" onClick={onConfirm}>确认删除</button></div></div></div>;
}

function ProjectHome({ project, projects, mails, error, onSwitch, onOpenMail }: { project: Project; projects: Project[]; mails: Mail[]; error?: string; onSwitch: (s: string) => void; onOpenMail: () => void }) {
  return <><Header title={`${project.name} 客服首页`} subtitle={`${project.mailbox} · 当前显示真实邮箱数据`} action={<select className="project-select" value={project.id} onChange={(e) => onSwitch(e.target.value)}>{projects.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select>} /><section className="metric-grid four"><Metric label="已加载邮件" value={mails.length} /><Metric label="未读邮件" value={project.unread} /><Metric label="待审核回复" value={0} /><Metric label="真实支付记录" value="未接入" /></section><section className="dashboard-columns"><div className="panel"><div className="panel-title"><h2>最近邮件</h2><button onClick={onOpenMail}>查看全部邮件</button></div>{error ? <div className="warning">{error}</div> : mails.length ? <table><tbody>{mails.slice(0, 5).map((mail) => <tr key={mail.id}><td>{mail.sender}</td><td>{mail.title}</td><td><span className={`pill ${mail.unread ? "amber" : "neutral"}`}>{mail.unread ? "未读" : "已读"}</span></td></tr>)}</tbody></table> : <div className="empty-state">收件箱当前没有邮件</div>}</div><div className="panel"><div className="panel-title"><h2>连接状态</h2></div><div className="status-list"><div><strong>客服邮箱</strong><span>{project.mailbox}</span><em className={`pill ${project.connected ? "green" : "red"}`}>{project.connected ? "已连接" : "连接失败"}</em></div><div><strong>项目后台</strong><span>{project.backend}</span><em className="pill neutral">未接入</em></div><div><strong>数据说明</strong><span>不显示任何演示结论</span><em className="pill green">真实数据</em></div></div></div></section></>;
}

function Workbench({ projects, activeProject, onProject, mails, mail, onMail, search, onSearch, loading, errors, refreshedAt, onRefresh }: { projects: Project[]; activeProject: string; onProject: (s: string) => void; mails: Mail[]; mail: Mail | null; onMail: (id: string) => void; search: string; onSearch: (s: string) => void; loading: boolean; errors: Record<string, string>; refreshedAt: string; onRefresh: () => Promise<void> }) {
  const relevantError = activeProject === "all" ? errors.all : errors[activeProject];
  return <><Header title="全部邮件工作台" subtitle="邮件主题、发件人、正文和时间均来自真实收件箱" action={<div className="button-row"><select className="project-select" value={activeProject} onChange={(e) => onProject(e.target.value)}><option value="all">全部项目</option>{projects.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}</select><button onClick={() => void onRefresh()} disabled={loading}>{loading ? "正在同步…" : "刷新邮件"}</button></div>} /><div className="workbench">
    <section className="mail-list"><input className="search" value={search} onChange={(e) => onSearch(e.target.value)} placeholder="搜索真实邮件" /><div className="mail-count">{loading ? "正在读取邮箱…" : `共 ${mails.length} 封`}{refreshedAt && <small> · 最后同步 {new Date(refreshedAt).toLocaleTimeString("zh-CN", { hour12: false })}</small>}</div>{relevantError && <div className="warning">{relevantError}</div>}<div className="mail-scroll">{mails.map((item) => <button key={item.id} className={`mail-item ${item.id === mail?.id ? "selected" : ""}`} onClick={() => onMail(item.id)}><div><strong>{item.title}</strong><span className={`pill ${item.unread ? "amber" : "neutral"}`}>{item.unread ? "未读" : "已读"}</span></div><small>{item.sender} · {item.time}</small><p>{item.preview}</p></button>)}{!loading && !mails.length && <div className="empty-state">当前筛选下没有邮件</div>}</div></section>
    <section className="message-detail">{mail ? <><div className="detail-block"><div className="eyebrow">原始邮件</div><h2>{mail.title}</h2><p className="muted">来自 {mail.sender} · {mail.time}</p><p className="mail-body">{mail.original}</p></div><div className="detail-block"><div className="eyebrow">附件</div>{mail.attachments.length ? mail.attachments.map((file) => <p key={file.filename}>{file.filename} · {file.contentType} · {file.size} bytes</p>) : <p className="muted">此邮件没有附件</p>}</div></> : <div className="empty-state">请选择一封邮件</div>}</section>
    <section className="action-panel"><h2>真实处理状态</h2>{mail ? <><div className="action-section"><label>客户邮箱</label><div className="field-readonly">{mail.sender}</div></div><div className="action-section"><label>所属邮箱</label><div className="field-readonly">{mail.mailboxId === "kissly" ? "business@kissly.ai" : "business@xjoy.ai"}</div></div><div className="action-section"><label>账号匹配</label><div className="field-readonly multiline">项目后台尚未接入，未执行真实查询。</div></div><div className="action-section"><label>支付与到账</label><div className="field-readonly multiline">项目后台尚未接入，不生成支付结论。</div></div><div className="action-section"><label>AI 分析与回复</label><div className="field-readonly multiline">当前尚未接入真实 AI 分析流程，因此不显示演示翻译、分类、建议或回复草稿。</div></div></> : <div className="empty-state">选择邮件后显示可核实的信息</div>}</section>
  </div></>;
}

function PaymentMonitor({ projects, activeProject, onProject }: { projects: Project[]; activeProject: string; onProject: (s: string) => void }) {
  return <><Header title="支付问题监控" subtitle="项目后台尚未接入，因此不展示任何推测或演示支付记录" action={<select className="project-select" value={activeProject} onChange={(e) => onProject(e.target.value)}><option value="all">全部项目</option>{projects.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}</select>} /><section className="metric-grid four"><Metric label="真实支付记录" value={0} tag="后台未接入" /><Metric label="已核实到账" value={0} /><Metric label="到账异常" value={0} /><Metric label="查询失败" value={0} /></section><section className="panel payment-panel-fixed"><div className="empty-state"><h2>暂无真实支付数据</h2><p>需要接入 x.pink 和 KISSLY 的项目后台查询接口后，才能显示订单、金额、支付状态和到账状态。</p></div></section></>;
}

function EmptyFeature({ title, text }: { title: string; text: string }) {
  return <><Header title={title} subtitle="仅显示已经由真实数据源产生的记录" /><section className="panel"><div className="empty-state"><h2>暂无真实记录</h2><p>{text}</p></div></section></>;
}

function ProjectSettings({ projects, onAdd, onEdit }: { projects: Project[]; onAdd: () => void; onEdit: (p: Project) => void }) {
  return <><Header title="项目设置" subtitle="每个项目独立配置邮箱、后台和赔偿规则" action={<button className="primary" onClick={onAdd}>＋ 新增项目</button>} /><section className="panel settings-list">{projects.map((project) => <article key={project.id}><div><h2>{project.name}</h2><p>{project.website}</p></div><div><span>客服邮箱</span><strong>{project.mailbox}</strong></div><div><span>后台地址</span><strong>{project.backend}</strong></div><div><span>默认赔偿</span><strong>{project.defaultGems} {project.gems}</strong></div><button onClick={() => onEdit(project)}>编辑设置</button></article>)}</section></>;
}
