import { T as __toESM, b as require_react, t as require_jsx_runtime } from "../index.js";
import { t as Image } from "./image-DSTmMjLa.js";
import { t as Link } from "./link-CpPuKMyP.js";
//#region app/admin/admin-login.tsx
var import_react = /* @__PURE__ */ __toESM(require_react(), 1);
var import_jsx_runtime = require_jsx_runtime();
function AdminLogin() {
	const [username, setUsername] = (0, import_react.useState)("");
	const [password, setPassword] = (0, import_react.useState)("");
	const [error, setError] = (0, import_react.useState)("");
	const [loading, setLoading] = (0, import_react.useState)(false);
	const submit = async (event) => {
		event.preventDefault();
		setError("");
		setLoading(true);
		try {
			const response = await fetch("/analyze/api/admin/login", {
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
			window.location.replace("/admin");
		} catch {
			setError("目前無法登入，請稍後再試");
		} finally {
			setLoading(false);
		}
	};
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("main", {
		className: "admin-login-shell",
		children: [
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", { className: "ambient ambient-one" }),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", { className: "ambient ambient-two" }),
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("section", {
				className: "admin-login-card",
				children: [
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Image, {
						className: "login-brand-logo",
						src: "/mt1399-logo.png",
						alt: "MT1399",
						width: 560,
						height: 118,
						priority: true
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
						className: "eyebrow",
						children: "ADMIN ACCESS"
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h1", { children: "管理後台登入" }),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
						className: "admin-login-lead",
						children: "此區僅限授權管理員使用，請輸入後台專用帳號密碼。"
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("form", {
						onSubmit: submit,
						className: "login-form",
						children: [
							/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("label", { children: ["管理員帳號", /* @__PURE__ */ (0, import_jsx_runtime.jsx)("input", {
								value: username,
								onChange: (event) => setUsername(event.target.value),
								autoComplete: "username",
								placeholder: "輸入管理員帳號"
							})] }),
							/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("label", { children: ["管理員密碼", /* @__PURE__ */ (0, import_jsx_runtime.jsx)("input", {
								value: password,
								onChange: (event) => setPassword(event.target.value),
								autoComplete: "current-password",
								type: "password",
								placeholder: "輸入管理員密碼"
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
								children: loading ? "正在驗證…" : /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(import_jsx_runtime.Fragment, { children: ["登入管理後台 ", /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { children: "→" })] })
							})
						]
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Link, {
						className: "back-to-member",
						href: "/",
						children: "← 返回會員登入"
					})
				]
			})
		]
	});
}
//#endregion
export { AdminLogin as default };
