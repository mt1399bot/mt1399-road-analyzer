import { T as __toESM, b as require_react, t as require_jsx_runtime } from "../index.js";
import { t as Image } from "./image-DSTmMjLa.js";
//#region app/member-login.tsx
var import_react = /* @__PURE__ */ __toESM(require_react(), 1);
var import_jsx_runtime = require_jsx_runtime();
function MemberLogin() {
	const [username, setUsername] = (0, import_react.useState)("");
	const [password, setPassword] = (0, import_react.useState)("");
	const [error, setError] = (0, import_react.useState)("");
	const [loading, setLoading] = (0, import_react.useState)(false);
	const login = async (event) => {
		event.preventDefault();
		setError("");
		setLoading(true);
		try {
			const response = await fetch("/analyze/api/member/login", {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({
					username,
					password
				})
			});
			const result = await response.json();
			if (!response.ok) {
				setError(result.error ?? "帳號或密碼錯誤");
				return;
			}
			window.location.replace("/");
		} catch {
			setError("目前無法登入，請稍後再試");
		} finally {
			setLoading(false);
		}
	};
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("main", {
		className: "login-shell",
		children: [
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", { className: "ambient ambient-one" }),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", { className: "ambient ambient-two" }),
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("section", {
				className: "login-card",
				children: [
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Image, {
						className: "login-brand-logo",
						src: "/mt1399-logo.png",
						alt: "MT1399",
						width: 560,
						height: 118,
						priority: true
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("p", {
						className: "eyebrow",
						children: ["MEMBER ANALYTICS ", /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
							className: "login-version",
							children: "v1.0"
						})]
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("h1", { children: [
						"百家樂牌路",
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)("br", {}),
						"機率分析器"
					] }),
					/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("form", {
						onSubmit: login,
						className: "login-form",
						children: [
							/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("label", { children: ["會員帳號", /* @__PURE__ */ (0, import_jsx_runtime.jsx)("input", {
								value: username,
								onChange: (event) => setUsername(event.target.value),
								autoComplete: "username",
								placeholder: "輸入會員帳號"
							})] }),
							/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("label", { children: ["會員密碼", /* @__PURE__ */ (0, import_jsx_runtime.jsx)("input", {
								value: password,
								onChange: (event) => setPassword(event.target.value),
								autoComplete: "current-password",
								type: "password",
								placeholder: "輸入會員密碼"
							})] }),
							error && /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
								className: "form-error",
								role: "alert",
								children: error
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
								className: "primary-button",
								type: "submit",
								disabled: loading,
								children: loading ? "正在驗證…" : "Log In"
							})
						]
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
						className: "login-note",
						children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { children: "申請帳號請聯繫官方客服 LINE @mt7777" })
					})
				]
			})
		]
	});
}
//#endregion
export { MemberLogin as default };
