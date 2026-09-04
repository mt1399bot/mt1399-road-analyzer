import { T as __toESM, b as require_react, t as require_jsx_runtime } from "../index.js";
import { t as Image } from "./image-DSTmMjLa.js";
import { t as Link } from "./link-CpPuKMyP.js";
//#region app/admin/admin-console.tsx
var import_react = /* @__PURE__ */ __toESM(require_react(), 1);
var import_jsx_runtime = require_jsx_runtime();
function formatTaipeiTime(value) {
	const iso = value.includes("T") ? value : `${value.replace(" ", "T")}Z`;
	const date = new Date(iso);
	if (Number.isNaN(date.getTime())) return value;
	return new Intl.DateTimeFormat("zh-TW", {
		timeZone: "Asia/Taipei",
		year: "numeric",
		month: "2-digit",
		day: "2-digit",
		hour: "2-digit",
		minute: "2-digit",
		hour12: false
	}).format(date);
}
function AdminConsole() {
	const [members, setMembers] = (0, import_react.useState)([]);
	const [trials, setTrials] = (0, import_react.useState)([]);
	const [label, setLabel] = (0, import_react.useState)("");
	const [duration, setDuration] = (0, import_react.useState)("30");
	const [dailyLimit, setDailyLimit] = (0, import_react.useState)(10);
	const [newMemberLiveAccess, setNewMemberLiveAccess] = (0, import_react.useState)(false);
	const [newMemberLearningAccess, setNewMemberLearningAccess] = (0, import_react.useState)(false);
	const [expiryDrafts, setExpiryDrafts] = (0, import_react.useState)({});
	const [generated, setGenerated] = (0, import_react.useState)(null);
	const [copied, setCopied] = (0, import_react.useState)(false);
	const [query, setQuery] = (0, import_react.useState)("");
	const [trialQuery, setTrialQuery] = (0, import_react.useState)("");
	const [loading, setLoading] = (0, import_react.useState)(true);
	const [submitting, setSubmitting] = (0, import_react.useState)(false);
	const [deletingId, setDeletingId] = (0, import_react.useState)(null);
	const [updatingMemberId, setUpdatingMemberId] = (0, import_react.useState)(null);
	const [deletingTrialId, setDeletingTrialId] = (0, import_react.useState)(null);
	const [error, setError] = (0, import_react.useState)("");
	const loadData = (0, import_react.useCallback)(async (silent = false) => {
		if (!silent) {
			setLoading(true);
			setError("");
		}
		try {
			const [memberResponse, trialResponse] = await Promise.all([fetch("/analyze/api/admin/members", { cache: "no-store" }), fetch("/analyze/api/admin/trials", { cache: "no-store" })]);
			const memberData = await memberResponse.json();
			const trialData = await trialResponse.json();
			if (memberResponse.status === 401 || trialResponse.status === 401) {
				window.location.replace("/admin");
				return;
			}
			if (!memberResponse.ok || !memberData.members) throw new Error(memberData.error || "讀取會員資料失敗");
			if (!trialResponse.ok || !trialData.trials) throw new Error(trialData.error || "讀取試用版紀錄失敗");
			setMembers(memberData.members);
			setTrials(trialData.trials);
		} catch (cause) {
			setError(cause instanceof Error ? cause.message : "讀取後台資料失敗");
		} finally {
			if (!silent) setLoading(false);
		}
	}, []);
	(0, import_react.useEffect)(() => {
		const timer = window.setTimeout(() => void loadData(), 0);
		const refreshTimer = window.setInterval(() => void loadData(true), 3e4);
		return () => {
			window.clearTimeout(timer);
			window.clearInterval(refreshTimer);
		};
	}, [loadData]);
	const filtered = (0, import_react.useMemo)(() => members.filter((member) => `${member.username}${member.label}${member.lastLoginDevice ?? ""}`.toLowerCase().includes(query.toLowerCase())), [members, query]);
	const filteredTrials = (0, import_react.useMemo)(() => trials.filter((trial) => `${trial.ipAddress}${trial.device}`.toLowerCase().includes(trialQuery.toLowerCase())), [trials, trialQuery]);
	const expiringSoon = (0, import_react.useMemo)(() => {
		const today = /* @__PURE__ */ new Date();
		const sevenDaysLater = new Date(today.getTime() + 7 * 864e5);
		return members.filter((member) => {
			const expiry = /* @__PURE__ */ new Date(`${member.expires}T23:59:59+08:00`);
			return member.status !== "expired" && expiry >= today && expiry <= sevenDaysLater;
		}).length;
	}, [members]);
	const createMember = async (event) => {
		event.preventDefault();
		setSubmitting(true);
		setError("");
		try {
			const response = await fetch("/analyze/api/admin/members", {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({
					label,
					duration,
					dailyLimit,
					liveAnalysisEnabled: newMemberLiveAccess,
					learningEnabled: newMemberLearningAccess
				})
			});
			const data = await response.json();
			if (response.status === 401) {
				window.location.replace("/admin");
				return;
			}
			if (!response.ok || !data.member || !data.credentials) throw new Error(data.error || "建立會員帳號失敗");
			setMembers((current) => [data.member, ...current]);
			setGenerated(data.credentials);
			setLabel("");
			setNewMemberLiveAccess(false);
			setNewMemberLearningAccess(false);
			setCopied(false);
		} catch (cause) {
			setError(cause instanceof Error ? cause.message : "建立會員帳號失敗");
		} finally {
			setSubmitting(false);
		}
	};
	const updateMemberSettings = async (member, settings) => {
		setUpdatingMemberId(member.id);
		setError("");
		try {
			const response = await fetch("/analyze/api/admin/members", {
				method: "PATCH",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({
					id: member.id,
					...settings
				})
			});
			const data = await response.json();
			if (response.status === 401) {
				window.location.replace("/admin");
				return;
			}
			if (!response.ok || !data.member) throw new Error(data.error || "更新會員設定失敗");
			setMembers((current) => current.map((item) => item.id === member.id ? data.member : item));
		} catch (cause) {
			setError(cause instanceof Error ? cause.message : "更新會員設定失敗");
		} finally {
			setUpdatingMemberId(null);
		}
	};
	const copyCredentials = async () => {
		if (!generated) return;
		await navigator.clipboard.writeText(`牌路分析器會員帳號\n帳號：${generated.username}\n密碼：${generated.password}`);
		setCopied(true);
	};
	const toggleMember = async (member) => {
		const nextStatus = member.status === "active" ? "paused" : "active";
		setError("");
		try {
			const response = await fetch("/analyze/api/admin/members/status", {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({
					id: member.id,
					status: nextStatus
				})
			});
			const data = await response.json();
			if (response.status === 401) {
				window.location.replace("/admin");
				return;
			}
			if (!response.ok) throw new Error(data.error || "更新會員狀態失敗");
			setMembers((current) => current.map((item) => item.id === member.id ? {
				...item,
				status: nextStatus,
				isOnline: false
			} : item));
		} catch (cause) {
			setError(cause instanceof Error ? cause.message : "更新會員狀態失敗");
		}
	};
	const deleteMember = async (member) => {
		if (!window.confirm(`確定要永久刪除會員 ${member.username}？\n\n刪除後無法復原，該會員會立即無法登入，使用紀錄也會一併刪除。`)) return;
		setDeletingId(member.id);
		setError("");
		try {
			const response = await fetch("/analyze/api/admin/members", {
				method: "DELETE",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ id: member.id })
			});
			const data = await response.json();
			if (response.status === 401) {
				window.location.replace("/admin");
				return;
			}
			if (!response.ok) throw new Error(data.error || "刪除會員帳號失敗");
			setMembers((current) => current.filter((item) => item.id !== member.id));
			setGenerated((current) => current?.username === member.username ? null : current);
		} catch (cause) {
			setError(cause instanceof Error ? cause.message : "刪除會員帳號失敗");
		} finally {
			setDeletingId(null);
		}
	};
	const toggleTrial = async (trial) => {
		const nextStatus = trial.status === "active" ? "disabled" : "active";
		setError("");
		try {
			const response = await fetch("/analyze/api/admin/trials/status", {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({
					id: trial.id,
					status: nextStatus
				})
			});
			const data = await response.json();
			if (response.status === 401) {
				window.location.replace("/admin");
				return;
			}
			if (!response.ok) throw new Error(data.error || "更新試用狀態失敗");
			setTrials((current) => current.map((item) => item.id === trial.id ? {
				...item,
				status: nextStatus
			} : item));
		} catch (cause) {
			setError(cause instanceof Error ? cause.message : "更新試用狀態失敗");
		}
	};
	const deleteTrial = async (trial) => {
		if (!window.confirm(`確定要刪除試用 IP ${trial.ipAddress}？\n\n刪除後該 IP 的使用次數會歸零；若再次開啟試用版，系統會建立一筆新的紀錄。若要持續禁止使用，請改用「停用」。`)) return;
		setDeletingTrialId(trial.id);
		setError("");
		try {
			const response = await fetch("/analyze/api/admin/trials", {
				method: "DELETE",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ id: trial.id })
			});
			const data = await response.json();
			if (response.status === 401) {
				window.location.replace("/admin");
				return;
			}
			if (!response.ok) throw new Error(data.error || "刪除試用紀錄失敗");
			setTrials((current) => current.filter((item) => item.id !== trial.id));
		} catch (cause) {
			setError(cause instanceof Error ? cause.message : "刪除試用紀錄失敗");
		} finally {
			setDeletingTrialId(null);
		}
	};
	const logout = async () => {
		await fetch("/analyze/api/admin/logout", { method: "POST" });
		window.location.replace("/admin");
	};
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("main", {
		className: "admin-shell",
		children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("aside", {
			className: "admin-sidebar",
			children: [
				/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
					className: "admin-logo",
					children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Image, {
						className: "admin-brand-logo",
						src: "/mt1399-logo.png",
						alt: "MT1399",
						width: 560,
						height: 118
					}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("strong", { children: "管理後台" }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { children: "ROAD ANALYTICS" })] })]
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("nav", { children: [
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("a", {
						className: "active",
						href: "#members",
						children: "會員管理"
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("a", {
						href: "#trials",
						children: "試用版 IP"
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("a", {
						href: "#generator",
						children: "建立帳號"
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("a", {
						href: "#usage",
						children: "使用紀錄"
					})
				] }),
				/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
					className: "admin-owner",
					children: [
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { children: "ADMIN" }),
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)("strong", { children: "系統管理員" }),
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
							type: "button",
							onClick: logout,
							children: "登出管理後台 →"
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Link, {
							href: "/",
							children: "返回會員登入"
						})
					]
				})
			]
		}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("section", {
			className: "admin-main",
			children: [
				/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("header", {
					className: "admin-header",
					children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", { children: "MEMBER CONTROL" }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("h1", { children: "會員管理中心" })] }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
						className: "prototype-tag",
						children: "資料庫已連線"
					})]
				}),
				error && /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
					className: "admin-error",
					role: "alert",
					children: [
						error,
						" ",
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
							type: "button",
							onClick: () => void loadData(),
							children: "重新整理"
						})
					]
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
					id: "usage",
					className: "admin-metrics",
					children: [
						/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("article", { children: [
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { children: "有效會員" }),
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)("strong", { children: members.filter((member) => member.status === "active").length }),
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)("small", { children: "可正常登入" })
						] }),
						/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("article", { children: [
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { children: "今日分析次數" }),
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)("strong", { children: members.reduce((sum, member) => sum + member.usedToday, 0) }),
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)("small", { children: "所有會員合計" })
						] }),
						/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("article", { children: [
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { children: "試用版 IP" }),
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)("strong", { children: trials.length }),
							/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("small", { children: [trials.filter((trial) => trial.status === "disabled").length, " 個已停用"] })
						] }),
						/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("article", { children: [
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { children: "即將到期" }),
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)("strong", { children: expiringSoon }),
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)("small", { children: "未來 7 天內" })
						] })
					]
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("section", {
					className: "admin-grid",
					children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("article", {
						id: "generator",
						className: "admin-panel generator-panel",
						children: [
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
								className: "admin-panel-title",
								children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { children: "+" }), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", { children: "CREATE MEMBER" }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("h2", { children: "產生會員帳號" })] })] })
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("form", {
								onSubmit: createMember,
								className: "generator-form",
								children: [
									/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("label", { children: ["會員備註", /* @__PURE__ */ (0, import_jsx_runtime.jsx)("input", {
										value: label,
										onChange: (event) => setLabel(event.target.value),
										placeholder: "例如：王先生、VIP A"
									})] }),
									/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
										className: "split-fields",
										children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("label", { children: ["帳號效期", /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("select", {
											value: duration,
											onChange: (event) => setDuration(event.target.value),
											children: [
												/* @__PURE__ */ (0, import_jsx_runtime.jsx)("option", {
													value: "7",
													children: "7 天"
												}),
												/* @__PURE__ */ (0, import_jsx_runtime.jsx)("option", {
													value: "30",
													children: "30 天"
												}),
												/* @__PURE__ */ (0, import_jsx_runtime.jsx)("option", {
													value: "90",
													children: "90 天"
												}),
												/* @__PURE__ */ (0, import_jsx_runtime.jsx)("option", {
													value: "180",
													children: "180 天"
												}),
												/* @__PURE__ */ (0, import_jsx_runtime.jsx)("option", {
													value: "365",
													children: "365 天"
												}),
												/* @__PURE__ */ (0, import_jsx_runtime.jsx)("option", {
													value: "permanent",
													children: "永久"
												})
											]
										})] }), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("label", { children: ["每日次數", /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("select", {
											value: dailyLimit,
											onChange: (event) => setDailyLimit(Number(event.target.value)),
											children: [
												/* @__PURE__ */ (0, import_jsx_runtime.jsx)("option", {
													value: 5,
													children: "5 次"
												}),
												/* @__PURE__ */ (0, import_jsx_runtime.jsx)("option", {
													value: 10,
													children: "10 次"
												}),
												/* @__PURE__ */ (0, import_jsx_runtime.jsx)("option", {
													value: 20,
													children: "20 次"
												}),
												/* @__PURE__ */ (0, import_jsx_runtime.jsx)("option", {
													value: 50,
													children: "50 次"
												})
											]
										})] })]
									}),
									/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("label", { children: ["畫面即時分析", /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("select", {
										value: newMemberLiveAccess ? "enabled" : "disabled",
										onChange: (event) => setNewMemberLiveAccess(event.target.value === "enabled"),
										children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("option", {
											value: "disabled",
											children: "暫不開通（預設）"
										}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("option", {
											value: "enabled",
											children: "建立後立即開通"
										})]
									})] }),
									/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("label", { children: ["校準學習", /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("select", {
										value: newMemberLearningAccess ? "enabled" : "disabled",
										onChange: (event) => setNewMemberLearningAccess(event.target.value === "enabled"),
										children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("option", {
											value: "disabled",
											children: "暫不開通（預設）"
										}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("option", {
											value: "enabled",
											children: "建立後立即開通"
										})]
									})] }),
									/* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
										type: "submit",
										disabled: submitting,
										children: submitting ? "正在建立…" : "立即產生帳號"
									})
								]
							}),
							generated ? /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
								className: "credential-card",
								children: [
									/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { children: "新帳號" }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("strong", { children: generated.username })] }),
									/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { children: "初始密碼" }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("strong", { children: generated.password })] }),
									/* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
										onClick: copyCredentials,
										children: copied ? "已複製" : "複製給會員"
									})
								]
							}) : /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
								className: "generator-empty",
								children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { children: "帳號與高強度密碼將自動產生" }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("small", { children: "密碼只在建立當下顯示一次" })]
							})
						]
					}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("article", {
						className: "admin-panel policy-panel",
						children: [
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", { children: "ACCESS POLICY" }),
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h2", { children: "會員登入規則" }),
							/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { children: "公開註冊" }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("b", {
								className: "off",
								children: "關閉"
							})] }),
							/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { children: "帳號建立者" }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("b", { children: "僅管理員" })] }),
							/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { children: "密碼保存" }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("b", { children: "安全雜湊" })] }),
							/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { children: "到期處理" }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("b", { children: "自動停用" })] }),
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
								className: "policy-note",
								children: "後台建立的帳號會立即同步到會員登入；原始密碼只顯示一次，資料庫不保存明碼。"
							})
						]
					})]
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("section", {
					id: "members",
					className: "admin-panel members-panel",
					children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
						className: "member-table-heading",
						children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", { children: "MEMBERS" }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("h2", { children: "會員帳號列表" })] }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("input", {
							value: query,
							onChange: (event) => setQuery(event.target.value),
							placeholder: "搜尋帳號或備註"
						})]
					}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
						className: "member-table-wrap",
						children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("table", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("thead", { children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("tr", { children: [
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)("th", { children: "會員" }),
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)("th", { children: "有效期限" }),
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)("th", { children: "今日使用" }),
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)("th", { children: "畫面即時分析" }),
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)("th", { children: "校準學習" }),
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)("th", { children: "最後登入日期" }),
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)("th", { children: "登入裝置" }),
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)("th", { children: "狀態" }),
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)("th", { children: "操作" })
						] }) }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("tbody", { children: loading ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("tr", { children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)("td", {
							colSpan: 9,
							children: "正在讀取會員資料…"
						}) }) : filtered.length === 0 ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("tr", { children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)("td", {
							colSpan: 9,
							children: "目前沒有符合的會員帳號"
						}) }) : filtered.map((member) => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("tr", { children: [
							/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("td", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("strong", { children: member.username }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { children: member.label })] }),
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)("td", { children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
								className: "member-expiry-editor",
								children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("strong", { children: member.expires === "9999-12-31" ? "永久" : member.expires }), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("select", {
									value: expiryDrafts[member.id] ?? "30",
									onChange: (event) => setExpiryDrafts((current) => ({
										...current,
										[member.id]: event.target.value
									})),
									children: [
										/* @__PURE__ */ (0, import_jsx_runtime.jsx)("option", {
											value: "7",
											children: "自今日起 7 天"
										}),
										/* @__PURE__ */ (0, import_jsx_runtime.jsx)("option", {
											value: "30",
											children: "自今日起 30 天"
										}),
										/* @__PURE__ */ (0, import_jsx_runtime.jsx)("option", {
											value: "90",
											children: "自今日起 90 天"
										}),
										/* @__PURE__ */ (0, import_jsx_runtime.jsx)("option", {
											value: "180",
											children: "自今日起 180 天"
										}),
										/* @__PURE__ */ (0, import_jsx_runtime.jsx)("option", {
											value: "365",
											children: "自今日起 365 天"
										}),
										/* @__PURE__ */ (0, import_jsx_runtime.jsx)("option", {
											value: "permanent",
											children: "改為永久"
										})
									]
								}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
									disabled: updatingMemberId === member.id || deletingId === member.id,
									onClick: () => void updateMemberSettings(member, { duration: expiryDrafts[member.id] ?? "30" }),
									children: "更新"
								})] })]
							}) }),
							/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("td", { children: [
								/* @__PURE__ */ (0, import_jsx_runtime.jsx)("b", { children: member.usedToday }),
								" / ",
								member.dailyLimit
							] }),
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)("td", { children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
								className: `live-access-toggle ${member.liveAnalysisEnabled ? "enabled" : ""}`,
								disabled: updatingMemberId === member.id || deletingId === member.id,
								onClick: () => void updateMemberSettings(member, { liveAnalysisEnabled: !member.liveAnalysisEnabled }),
								children: member.liveAnalysisEnabled ? "已開通" : "未開通"
							}) }),
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)("td", { children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
								className: `learning-access-toggle ${member.learningEnabled ? "enabled" : ""}`,
								disabled: updatingMemberId === member.id || deletingId === member.id,
								onClick: () => void updateMemberSettings(member, { learningEnabled: !member.learningEnabled }),
								children: member.learningEnabled ? "已開通" : "未開通"
							}) }),
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)("td", {
								className: "member-login-time",
								children: member.lastLoginAt ? formatTaipeiTime(member.lastLoginAt) : "尚未登入"
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)("td", {
								className: "member-device",
								children: member.lastLoginDevice || "尚未記錄"
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)("td", { children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)("i", {
								className: `member-status ${member.status === "active" ? member.isOnline ? "online" : "offline" : member.status}`,
								children: member.status === "paused" ? "已暫停" : member.status === "expired" ? "已到期" : member.isOnline ? "上線中" : "離線中"
							}) }),
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)("td", { children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
								className: "member-actions",
								children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
									disabled: member.status === "expired" || deletingId === member.id || updatingMemberId === member.id,
									onClick: () => toggleMember(member),
									children: member.status === "active" ? "暫停" : "啟用"
								}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
									className: "delete-member",
									disabled: deletingId === member.id || updatingMemberId === member.id,
									onClick: () => deleteMember(member),
									children: deletingId === member.id ? "刪除中…" : "刪除"
								})]
							}) })
						] }, member.id)) })] })
					})]
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("section", {
					id: "trials",
					className: "admin-panel members-panel trial-panel",
					children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
						className: "member-table-heading",
						children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", { children: "TRIAL VISITORS" }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("h2", { children: "試用版 IP 管理" })] }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("input", {
							value: trialQuery,
							onChange: (event) => setTrialQuery(event.target.value),
							placeholder: "搜尋 IP 或裝置"
						})]
					}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
						className: "member-table-wrap",
						children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("table", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("thead", { children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("tr", { children: [
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)("th", { children: "IP 位址" }),
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)("th", { children: "裝置" }),
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)("th", { children: "使用次數" }),
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)("th", { children: "首次／最近使用" }),
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)("th", { children: "狀態" }),
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)("th", { children: "操作" })
						] }) }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("tbody", { children: loading ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("tr", { children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)("td", {
							colSpan: 6,
							children: "正在讀取試用版紀錄…"
						}) }) : filteredTrials.length === 0 ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("tr", { children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)("td", {
							colSpan: 6,
							children: "目前沒有符合的試用版紀錄"
						}) }) : filteredTrials.map((trial) => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("tr", { children: [
							/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("td", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("strong", {
								className: "trial-ip",
								children: trial.ipAddress
							}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { children: "同 IP 累計" })] }),
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)("td", { children: trial.device }),
							/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("td", {
								className: "trial-usage",
								children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("b", { children: trial.used }), " / 20 局"]
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)("td", { children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
								className: "trial-times",
								children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", { children: ["首次 ", formatTaipeiTime(trial.firstSeen)] }), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", { children: ["最近 ", formatTaipeiTime(trial.lastSeen)] })]
							}) }),
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)("td", { children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)("i", {
								className: `member-status ${trial.status}`,
								children: trial.status === "active" ? "可使用" : "已停用"
							}) }),
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)("td", { children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
								className: "member-actions",
								children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
									disabled: deletingTrialId === trial.id,
									onClick: () => toggleTrial(trial),
									children: trial.status === "active" ? "停用" : "啟用"
								}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
									className: "delete-member",
									disabled: deletingTrialId === trial.id,
									onClick: () => deleteTrial(trial),
									children: deletingTrialId === trial.id ? "刪除中…" : "刪除"
								})]
							}) })
						] }, trial.id)) })] })
					})]
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
					className: "admin-disclaimer",
					children: "試用版只記錄連線 IP、裝置類型、使用次數與時間，不會保存會員的牌路截圖或分享畫面。"
				})
			]
		})]
	});
}
//#endregion
export { AdminConsole as default };
