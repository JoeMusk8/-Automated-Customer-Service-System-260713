"use client";

import { FormEvent, useMemo, useState } from "react";

type PageKey = "dashboard" | "project" | "workbench" | "review" | "payments" | "reports" | "settings";
type Priority = "高" | "中" | "低";
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
  payment: number;
};
type Mail = {
  id: number;
  project: string;
  sender: string;
  title: string;
  preview: string;
  original: string;
  translation: string;
  intent: string;
  category: string;
  priority: Priority;
  time: string;
  account: string;
  payment: string;
};

const initialProjects: Project[] = [
  { id: "x-pink", name: "x.pink", website: "https://www.x.pink/", mailbox: "business@xjoy.ai", backend: "https://www.xjoy.ai/x-admin/#/", status: "运行中", gems: "Gems", defaultGems: 500, unread: 36, payment: 8 },
  { id: "kissly", name: "KISSLY", website: "https://www.kissly.ai/", mailbox: "business@kissly.ai", backend: "https://www.kissly.ai/x-admin/#/", status: "运行中", gems: "Gems", defaultGems: 500, unread: 25, payment: 5 },
];

const initialMails: Mail[] = [
  { id: 1, project: "x-pink", sender: "user@example.com", title: "Payment issue", preview: "已支付 $89，但未收到 5000 Gems", original: "Hi, I just paid $89 but did not receive 5000 Gems. Please help me check my account.", translation: "您好，我刚支付了 89 美元，但没有收到 5000 Gems。请帮我检查账户。", intent: "客户表示已完成付款，但 Gems 未到账，需要核实充值记录。", category: "支付问题", priority: "高", time: "10:35", account: "已匹配 user@example.com", payment: "已查到充值记录：$89 / 5000 Gems / 成功" },
  { id: 2, project: "x-pink", sender: "maria@example.com", title: "Generation result", preview: "生成结果不满意，希望补偿", original: "The generation result is not what I expected. The faces are distorted.", translation: "生成结果与我的预期不符，人物面部出现了变形。", intent: "客户对生成质量不满意，希望获得处理或补偿。", category: "产品投诉", priority: "中", time: "09:48", account: "已匹配 maria@example.com", payment: "不适用" },
  { id: 3, project: "x-pink", sender: "unknown@example.com", title: "Did not receive gems", preview: "邮箱未匹配到产品账号", original: "I bought gems yesterday but cannot find them in my account.", translation: "我昨天购买了 Gems，但在账户中找不到。", intent: "客户反馈购买后未到账，但发件邮箱未匹配到产品账号。", category: "支付问题", priority: "高", time: "09:12", account: "未找到账号", payment: "等待客户提供登录邮箱或用户 ID" },
  { id: 4, project: "x-pink", sender: "hana@example.jp", title: "Feature suggestion", preview: "希望增加批量处理功能", original: "複数の画像を一括で処理できる機能を追加してほしいです。", translation: "希望增加可以批量处理多张图片的功能。", intent: "客户提出产品功能建议。", category: "建议反馈", priority: "低", time: "08:51", account: "未查询", payment: "不适用" },
  { id: 5, project: "x-pink", sender: "alex@example.com", title: "How to cancel", preview: "咨询如何取消订阅", original: "How can I cancel my subscription?", translation: "我该如何取消订阅？", intent: "客户咨询订阅取消方式。", category: "普通咨询", priority: "低", time: "08:20", account: "未查询", payment: "不适用" },
  { id: 6, project: "x-pink", sender: "promo@example.com", title: "Marketing cooperation", preview: "营销推广邮件", original: "We can grow your traffic with our marketing package.", translation: "我们可以通过营销套餐提高您的流量。", intent: "与客服售后无关的营销邮件。", category: "垃圾邮件", priority: "低", time: "07:42", account: "不适用", payment: "不适用" },
  { id: 7, project: "kissly", sender: "kissly.user@example.com", title: "Credits not received", preview: "购买后未收到 Credits", original: "I completed the purchase but my credits are still missing.", translation: "我已完成购买，但 Credits 仍未到账。", intent: "客户反馈支付后 Credits 未到账。", category: "支付问题", priority: "高", time: "10:08", account: "已匹配 kissly.user@example.com", payment: "未查到充值记录" },
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
  const [selectedMail, setSelectedMail] = useState(1);
  const [categoryFilter, setCategoryFilter] = useState("全部");
  const [priorityFilter, setPriorityFilter] = useState("全部");
  const [search, setSearch] = useState("");
  const [reviewTab, setReviewTab] = useState<"mail" | "gems">("mail");
  const [replyEditing, setReplyEditing] = useState(false);
  const [reply, setReply] = useState("您好，我们确认您的 89 美元充值已成功，5000 Gems 已到账。请重新登录后查看。");
  const [toast, setToast] = useState("");

  const currentProject = projects.find((item) => item.id === activeProject) || projects[0];
  const visibleMails = useMemo(() => initialMails.filter((mail) => {
    const projectMatch = activeProject === "all" || mail.project === activeProject;
    const categoryMatch = categoryFilter === "全部" || mail.category === categoryFilter;
    const priorityMatch = priorityFilter === "全部" || mail.priority === priorityFilter;
    const needle = search.toLowerCase();
    const searchMatch = !needle || `${mail.title} ${mail.sender} ${mail.preview}`.toLowerCase().includes(needle);
    return projectMatch && categoryMatch && priorityMatch && searchMatch;
  }), [activeProject, categoryFilter, priorityFilter, search]);
  const mail = initialMails.find((item) => item.id === selectedMail) || visibleMails[0] || initialMails[0];

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
        {page === "dashboard" && <Dashboard projects={projects} onAdd={() => { setEditingProject(null); setProjectModal("add"); }} onOpen={openProject} onEdit={editProject} onDelete={setDeleteProject} />}
        {page === "project" && <ProjectHome project={currentProject} onSwitch={(id) => { setActiveProject(id); }} projects={projects} onOpenMail={() => setPage("workbench")} />}
        {page === "workbench" && <Workbench projects={projects} activeProject={activeProject} onProject={setActiveProject} mails={visibleMails} mail={mail} onMail={setSelectedMail} search={search} onSearch={setSearch} category={categoryFilter} onCategory={setCategoryFilter} priority={priorityFilter} onPriority={setPriorityFilter} reply={reply} onReply={setReply} editing={replyEditing} onEditing={setReplyEditing} notify={notify} />}
        {page === "review" && <ReviewCenter tab={reviewTab} onTab={setReviewTab} project={currentProject} reply={reply} notify={notify} />}
        {page === "payments" && <PaymentMonitor projects={projects} activeProject={activeProject} onProject={setActiveProject} />}
        {page === "reports" && <Reports activeProject={activeProject} projects={projects} onProject={setActiveProject} />}
        {page === "settings" && <ProjectSettings projects={projects} onAdd={() => { setEditingProject(null); setProjectModal("add"); }} onEdit={editProject} />}
      </main>

      {projectModal && <ProjectForm mode={projectModal} project={editingProject} onClose={() => setProjectModal(null)} onSave={(value) => {
        if (projectModal === "edit" && editingProject) {
          setProjects((items) => items.map((item) => item.id === editingProject.id ? { ...item, ...value } : item));
        } else {
          setProjects((items) => [...items, { ...value, id: `project-${Date.now()}`, unread: 0, payment: 0 }]);
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
    <div className="sidebar-status"><strong>{activeProject === "all" ? "人工确认模式" : currentProject.mailbox}</strong><span><i /> 邮箱连接待配置</span><span><i className="gray" /> 后台连接待配置</span></div>
  </aside>;
}

function Header({ title, subtitle, action }: { title: string; subtitle: string; action?: React.ReactNode }) {
  return <header className="page-header"><div><h1>{title}</h1><p>{subtitle}</p></div>{action}</header>;
}

function Metric({ label, value, tag, tone = "neutral" }: { label: string; value: number | string; tag?: string; tone?: "neutral" | "red" | "amber" | "green" }) {
  return <div className="metric-card"><span>{label}</span><strong>{value}</strong>{tag && <em className={`pill ${tone}`}>{tag}</em>}</div>;
}

function Dashboard({ projects, onAdd, onOpen, onEdit, onDelete }: { projects: Project[]; onAdd: () => void; onOpen: (p: Project) => void; onEdit: (p: Project) => void; onDelete: (p: Project) => void }) {
  const unread = projects.reduce((sum, item) => sum + item.unread, 0);
  const payment = projects.reduce((sum, item) => sum + item.payment, 0);
  return <>
    <Header title="全部项目 Dashboard" subtitle="统一查看所有项目的客服状态" action={<button className="primary" onClick={onAdd}>＋ 新增项目</button>} />
    <section className="metric-grid four"><Metric label="未处理邮件" value={unread} tag={`${projects.length} 个项目`} /><Metric label="支付问题" value={payment} tag="最高优先级" tone="red" /><Metric label="待审核回复" value={9} tag="需人工确认" tone="amber" /><Metric label="待审核赔偿" value={4} tag="需人工确认" tone="amber" /></section>
    <section className="dashboard-columns">
      <div className="panel dashboard-fixed-panel"><div className="panel-title"><h2>项目管理</h2><span>共 {projects.length} 个项目</span></div><div className="project-scroll">
        {projects.map((project) => <article className="project-row" key={project.id}><div className="project-info"><h3>{project.name}</h3><a href={project.website} target="_blank">{project.website}</a><span>邮箱：{project.mailbox} · <b className="dot" /> 待配置</span><span>后台：{project.backend.replace("https://", "")} · <b className="dot" /> 待配置</span></div><span className="pill red">{project.payment} 个高优先级</span><div className="row-actions"><button className="primary" onClick={() => onOpen(project)}>进入管理</button><button onClick={() => onEdit(project)}>编辑</button><button className="danger" onClick={() => onDelete(project)}>删除</button></div></article>)}
      </div></div>
      <div className="panel dashboard-fixed-panel"><div className="panel-title"><h2>跨项目重点问题</h2></div><div className="issues-scroll"><table><thead><tr><th>项目</th><th>问题</th><th>数量</th><th>状态</th></tr></thead><tbody><tr><td>x.pink</td><td>充值成功未到账</td><td>8</td><td><span className="pill red">高</span></td></tr><tr><td>KISSLY</td><td>未查到支付记录</td><td>5</td><td><span className="pill red">高</span></td></tr><tr><td>x.pink</td><td>生成结果不满意</td><td>14</td><td><span className="pill amber">中</span></td></tr></tbody></table></div><div className="warning">项目数据相互隔离；切换项目后，邮件、账号和后台查询结果全部重新切换。</div></div>
    </section>
  </>;
}

function ProjectForm({ mode, project, onClose, onSave, notify }: { mode: "add" | "edit"; project: Project | null; onClose: () => void; onSave: (project: Omit<Project, "id" | "unread" | "payment">) => void; notify: (s: string) => void }) {
  function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const data = new FormData(e.currentTarget);
    onSave({ name: String(data.get("name")), website: String(data.get("website")), mailbox: String(data.get("mailbox")), backend: String(data.get("backend")), gems: String(data.get("gems")), defaultGems: Number(data.get("defaultGems")), status: String(data.get("status")) as "运行中" | "停用" });
  }
  return <div className="modal-backdrop"><form className="modal large" onSubmit={submit}><div className="modal-title"><div><h2>{mode === "add" ? "新增项目" : "编辑项目"}</h2><p>每个项目独立配置客服邮箱与项目后台</p></div><button type="button" onClick={onClose}>关闭</button></div><div className="form-grid"><section><h3>基础信息</h3><label>项目名称<input name="name" required defaultValue={project?.name || ""} /></label><label>项目网站<input name="website" required defaultValue={project?.website || "https://"} /></label><label>项目状态<select name="status" defaultValue={project?.status || "运行中"}><option>运行中</option><option>停用</option></select></label><label>后台地址<input name="backend" required defaultValue={project?.backend || "https://"} /></label></section><section><h3>邮箱与赔偿设置</h3><label>客服邮箱<input name="mailbox" type="email" required defaultValue={project?.mailbox || ""} /></label><div className="split"><label>IMAP 服务器<input placeholder="待填写" /></label><label>SMTP 服务器<input placeholder="待填写" /></label></div><button type="button" onClick={() => notify("尚未填写邮箱连接信息")}>测试邮箱连接</button><label>宝石名称<input name="gems" required defaultValue={project?.gems || "Gems"} /></label><label>默认赔偿数量<input name="defaultGems" type="number" required defaultValue={project?.defaultGems || 500} /></label><button type="button" onClick={() => notify("尚未配置后台登录信息")}>测试后台登录</button></section></div><div className="modal-actions"><button type="button" onClick={onClose}>取消</button><button className="primary" type="submit">保存</button></div></form></div>;
}

function ConfirmModal({ project, onCancel, onConfirm }: { project: Project; onCancel: () => void; onConfirm: () => void }) {
  return <div className="modal-backdrop"><div className="modal confirm"><h2>确认删除？</h2><p>停止监控项目“{project.name}”，默认保留历史工作报告。</p><div className="modal-actions"><button onClick={onCancel}>取消</button><button className="danger solid" onClick={onConfirm}>确认删除</button></div></div></div>;
}

function ProjectHome({ project, projects, onSwitch, onOpenMail }: { project: Project; projects: Project[]; onSwitch: (s: string) => void; onOpenMail: () => void }) {
  return <><Header title={`${project.name} 客服首页`} subtitle={`${project.mailbox} · 数据仅属于 ${project.name}`} action={<select className="project-select" value={project.id} onChange={(e) => onSwitch(e.target.value)}>{projects.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select>} /><section className="metric-grid six"><Metric label="今日未读邮件" value={project.unread} /><Metric label="支付问题" value={project.payment} tag="高优先级" tone="red" /><Metric label="产品投诉" value={14} /><Metric label="等待客户账号" value={3} /><Metric label="待审核回复" value={5} /><Metric label="待审核赔偿" value={7} /></section><section className="dashboard-columns"><div className="panel"><div className="panel-title"><h2>重点工单</h2><button onClick={onOpenMail}>查看全部邮件</button></div><table><tbody><tr><td>user@example.com</td><td>支付成功未到账</td><td><span className="pill red">高</span></td></tr><tr><td>unknown@example.com</td><td>等待客户账号</td><td><span className="pill amber">等待</span></td></tr><tr><td>maria@example.com</td><td>产品体验投诉</td><td><span className="pill amber">中</span></td></tr></tbody></table></div><div className="panel"><div className="panel-title"><h2>连接状态</h2></div><div className="status-list"><div><strong>客服邮箱</strong><span>{project.mailbox}</span><em className="pill amber">待配置</em></div><div><strong>项目后台</strong><span>{project.backend}</span><em className="pill amber">待配置</em></div><div><strong>网页连接器</strong><span>后台无公开 API</span><em className="pill neutral">未连接</em></div></div></div></section></>;
}

function Workbench({ projects, activeProject, onProject, mails, mail, onMail, search, onSearch, category, onCategory, priority, onPriority, reply, onReply, editing, onEditing, notify }: { projects: Project[]; activeProject: string; onProject: (s: string) => void; mails: Mail[]; mail: Mail; onMail: (n: number) => void; search: string; onSearch: (s: string) => void; category: string; onCategory: (s: string) => void; priority: string; onPriority: (s: string) => void; reply: string; onReply: (s: string) => void; editing: boolean; onEditing: (b: boolean) => void; notify: (s: string) => void }) {
  return <><Header title="全部邮件工作台" subtitle="显示当前项目的全部邮件，AI 结果仅作为处理辅助" action={<select className="project-select" value={activeProject} onChange={(e) => onProject(e.target.value)}><option value="all">全部项目</option>{projects.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}</select>} /><div className="workbench">
    <section className="mail-list"><input className="search" value={search} onChange={(e) => onSearch(e.target.value)} placeholder="搜索邮件" /><div className="filter-row"><select value={category} onChange={(e) => onCategory(e.target.value)}><option>全部</option><option>支付问题</option><option>产品投诉</option><option>建议反馈</option><option>普通咨询</option><option>垃圾邮件</option></select><select value={priority} onChange={(e) => onPriority(e.target.value)}><option>全部</option><option>高</option><option>中</option><option>低</option></select></div><div className="mail-count">全部 {mails.length}</div><div className="mail-scroll">{mails.map((item) => <button key={item.id} className={`mail-item ${item.id === mail.id ? "selected" : ""}`} onClick={() => onMail(item.id)}><div><strong>{item.title}</strong><span className={`pill ${item.priority === "高" ? "red" : item.priority === "中" ? "amber" : "neutral"}`}>{item.priority}</span></div><small>{item.sender} · {item.time}</small><p>{item.preview}</p></button>)}</div></section>
    <section className="message-detail"><div className="detail-block"><div className="eyebrow">原始邮件</div><h2>{mail.title}</h2><p className="muted">来自 {mail.sender} · {mail.time}</p><p>{mail.original}</p></div><div className="detail-block green-block"><div className="eyebrow">中文翻译</div><p>{mail.translation}</p></div><div className="detail-block"><div className="eyebrow">客户诉求</div><p>{mail.intent}</p><div className="tag-row"><span className="pill red">{mail.category}</span><span className="pill neutral">优先级 {mail.priority}</span></div></div><div className="detail-block"><div className="eyebrow">附件</div><p className="muted">此邮件没有附件</p></div></section>
    <section className="action-panel"><h2>处理方案</h2><div className="action-section"><label>客户邮箱</label><div className="field-readonly">{mail.sender}</div><button onClick={() => notify(mail.account)}>查询账号</button></div><div className="action-section"><label>账号匹配结果</label><div className={mail.account.includes("未找到") ? "result warning-result" : "result success-result"}>{mail.account}</div><button onClick={() => notify(mail.payment)}>查询充值</button></div><div className="action-section"><label>充值查询结果</label><div className="field-readonly multiline">{mail.payment}</div></div><div className="action-section"><label>AI 处理建议</label><div className="field-readonly multiline">{mail.account === "未找到账号" ? "询问客户的登录邮箱或用户 ID，收到信息后再查询。" : mail.category === "支付问题" ? "根据后台查询结果回复客户；发送前必须人工审核。" : "正常回复，必要时提交宝石赔偿审核。"}</div><button onClick={() => notify("AI 已重新分析当前邮件")}>重新分析</button></div><div className="action-section"><label>AI 回复草稿</label>{editing ? <textarea value={reply} onChange={(e) => onReply(e.target.value)} /> : <div className="field-readonly multiline">{reply}</div>}<div className="button-row"><button onClick={() => onEditing(!editing)}>{editing ? "完成编辑" : "编辑回复"}</button><button className="primary" onClick={() => notify("回复已提交人工审核，尚未发送")}>提交发信审核</button></div></div><div className="action-section"><label>赔偿方案</label><div className="field-readonly">当前支付记录正常，不建议赔偿。</div><button onClick={() => notify("赔偿方案已提交人工审核，尚未执行")}>提交赔偿审核</button></div><button className="full" onClick={() => notify("工单已转人工处理")}>转人工</button></section>
  </div></>;
}

function ReviewCenter({ tab, onTab, project, reply, notify }: { tab: "mail" | "gems"; onTab: (t: "mail" | "gems") => void; project: Project; reply: string; notify: (s: string) => void }) {
  return <><Header title="人工审核中心" subtitle="邮件发送和宝石赔偿分别确认，系统不会自动执行" /><div className="tabs"><button className={tab === "mail" ? "active" : ""} onClick={() => onTab("mail")}>邮件发送审核 <span>5</span></button><button className={tab === "gems" ? "active" : ""} onClick={() => onTab("gems")}>宝石赔偿审核 <span>4</span></button></div><div className="review-layout"><section className="panel review-list review-panel-fixed"><h2>{tab === "mail" ? "待审核回复" : "待审核赔偿"}</h2><div className="review-items-scroll"><button className="review-item selected"><strong>{tab === "mail" ? "x.pink Payment issue" : "x.pink Generation result"}</strong><span>{tab === "mail" ? "user@example.com" : "maria@example.com"}</span><small>{tab === "mail" ? "等待发送审核" : `建议赔偿 ${project.defaultGems} ${project.gems}`}</small></button><button className="review-item"><strong>KISSLY Credits not received</strong><span>kissly.user@example.com</span><small>等待人工确认</small></button></div></section><section className="panel review-detail review-panel-fixed"><div className="tag-row"><span className="pill green">{project.name}</span><span className="pill red">{tab === "mail" ? "支付问题" : "产品投诉"}</span></div><h2>{tab === "mail" ? "发送前确认" : "赔偿前确认"}</h2><dl><dt>项目与客户账号</dt><dd>{project.name} · user@example.com</dd><dt>原始诉求</dt><dd>客户表示已支付 89 美元，但没有收到 5000 Gems。</dd><dt>后台查询结果</dt><dd className="success-result">已查到记录：$89 · 5000 Gems · 支付成功</dd>{tab === "mail" ? <><dt>将要发送的完整邮件</dt><dd>{reply}</dd></> : <><dt>赔偿数量和原因</dt><dd>{project.defaultGems} {project.gems} · 产品体验补偿</dd></>}</dl><div className="button-row end"><button className="danger" onClick={() => notify("审核已拒绝，未执行任何操作")}>拒绝</button><button onClick={() => notify("已退回修改")}>退回修改</button><button className="primary" onClick={() => notify(tab === "mail" ? "已批准发送；等待邮箱连接后执行" : "已批准赔偿；等待后台连接后执行")}>批准{tab === "mail" ? "发送" : "赔偿"}</button></div><div className="warning">批准只针对当前操作；发信与赔偿不能使用同一个按钮执行。</div></section></div></>;
}

function PaymentMonitor({ projects, activeProject, onProject }: { projects: Project[]; activeProject: string; onProject: (s: string) => void }) {
  const rows = [{ project: "x.pink", user: "user@example.com", order: "XP-20260713-001", amount: "$89", time: "10:35", pay: "成功", delivery: "已到账", type: "充值成功" }, { project: "x.pink", user: "unknown@example.com", order: "—", amount: "—", time: "09:12", pay: "未查到记录", delivery: "无法判断", type: "未查到记录" }, { project: "KISSLY", user: "kissly.user@example.com", order: "KS-20260713-018", amount: "$29", time: "10:08", pay: "成功", delivery: "异常", type: "到账异常" }, { project: "x.pink", user: "error@example.com", order: "—", amount: "—", time: "08:32", pay: "查询失败", delivery: "无法判断", type: "查询失败" }].filter((row) => activeProject === "all" || row.project.toLowerCase().replace(".", "-") === activeProject);
  return <><Header title="支付问题监控" subtitle="支付查询失败时显示“无法判断”，不生成充值结论" action={<select className="project-select" value={activeProject} onChange={(e) => onProject(e.target.value)}><option value="all">全部项目</option>{projects.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}</select>} /><section className="metric-grid four"><Metric label="充值成功" value={7} tag="已核实" tone="green" /><Metric label="未查到记录" value={3} tag="等待客户信息" tone="amber" /><Metric label="到账异常" value={2} tag="高优先级" tone="red" /><Metric label="查询失败" value={1} tag="无法判断" /></section><section className="panel"><div className="panel-title"><h2>高优先级支付工单</h2><span>{activeProject === "all" ? "全部项目" : projects.find((p) => p.id === activeProject)?.name}</span></div><div className="table-scroll"><table><thead><tr><th>项目</th><th>客户账号</th><th>订单号</th><th>金额</th><th>时间</th><th>支付状态</th><th>到账状态</th></tr></thead><tbody>{rows.map((row) => <tr key={row.user}><td>{row.project}</td><td>{row.user}</td><td>{row.order}</td><td>{row.amount}</td><td>{row.time}</td><td><span className={`pill ${row.pay === "成功" ? "green" : row.pay === "查询失败" ? "red" : "amber"}`}>{row.pay}</span></td><td>{row.delivery}</td></tr>)}</tbody></table></div><div className="warning">后台查询失败的工单只能转人工处理，不能显示为充值成功或失败。</div></section></>;
}

function Reports({ activeProject, projects, onProject }: { activeProject: string; projects: Project[]; onProject: (s: string) => void }) {
  return <><Header title="客服工作报告" subtitle="每封邮件生成独立报告，记录完整处理过程" action={<div className="button-row"><select className="project-select" value={activeProject} onChange={(e) => onProject(e.target.value)}><option value="all">全部项目</option>{projects.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}</select><button onClick={() => window.print()}>导出 PDF</button></div>} /><div className="report-toolbar"><input placeholder="搜索客户邮箱或工单" /><select><option>全部投诉类型</option><option>支付问题</option><option>产品投诉</option><option>建议反馈</option><option>普通咨询</option></select><select><option>全部处理状态</option><option>处理中</option><option>已完成</option></select></div><div className="report-layout"><section className="panel report-list"><h2>工作报告</h2><button className="review-item selected"><strong>Payment issue</strong><span>user@example.com</span><small>x.pink · 已完成</small></button><button className="review-item"><strong>Generation result</strong><span>maria@example.com</span><small>x.pink · 处理中</small></button></section><article className="panel report"><div className="panel-title"><div><span className="pill green">x.pink</span><h2>Payment issue</h2></div><span className="pill red">高优先级</span></div><div className="report-grid"><ReportField label="项目 / 客服邮箱" text="x.pink · business@xjoy.ai" /><ReportField label="客户邮箱" text="user@example.com" /><ReportField label="投诉类型" text="支付问题" /><ReportField label="客户诉求" text="客户支付 89 美元后未收到 5000 Gems。" /><ReportField label="来信原文" text="Hi, I just paid $89 but did not receive 5000 Gems." /><ReportField label="中文翻译" text="您好，我刚支付了 89 美元，但没有收到 5000 Gems。" /><ReportField label="账号匹配结果" text="已匹配 user@example.com" /><ReportField label="充值查询结果" text="订单 XP-20260713-001 · $89 · 支付成功 · 已到账" /><ReportField label="回信内容" text="我们确认您的充值已成功，5000 Gems 已到账。请重新登录后查看。" /><ReportField label="赔偿记录" text="未赔偿" /><ReportField label="处理结果" text="已核实充值并提交回复审核" /><ReportField label="审核人与时间线" text="系统生成 10:36 → 人工审核 10:42 → 等待邮箱连接" /></div></article></div></>;
}

function ReportField({ label, text }: { label: string; text: string }) { return <div><strong>{label}</strong><p>{text}</p></div>; }

function ProjectSettings({ projects, onAdd, onEdit }: { projects: Project[]; onAdd: () => void; onEdit: (p: Project) => void }) {
  return <><Header title="项目设置" subtitle="每个项目独立配置邮箱、后台和赔偿规则" action={<button className="primary" onClick={onAdd}>＋ 新增项目</button>} /><section className="panel settings-list">{projects.map((project) => <article key={project.id}><div><h2>{project.name}</h2><p>{project.website}</p></div><div><span>客服邮箱</span><strong>{project.mailbox}</strong></div><div><span>后台地址</span><strong>{project.backend}</strong></div><div><span>默认赔偿</span><strong>{project.defaultGems} {project.gems}</strong></div><button onClick={() => onEdit(project)}>编辑设置</button></article>)}</section></>;
}
