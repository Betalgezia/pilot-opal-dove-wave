import { i as __toESM } from "../_runtime.mjs";
import { t as cva } from "../_libs/class-variance-authority+clsx.mjs";
import { u as require_react } from "../_libs/@floating-ui/react-dom+[...].mjs";
import { n as Slot, s as require_jsx_runtime } from "../_libs/@radix-ui/react-collection+[...].mjs";
import { a as object, i as number, n as boolean, o as string, t as array } from "../_libs/zod.mjs";
import { a as RefreshCcw, c as Info, d as Check, i as RotateCcw, l as Download, o as Plus, r as Trash2, s as LoaderCircle, t as X, u as Copy } from "../_libs/lucide-react.mjs";
import { t as useMutation } from "../_libs/tanstack__react-query.mjs";
import { a as DialogOverlay$1, c as DialogTrigger$1, i as DialogDescription$1, n as DialogClose, o as DialogPortal$1, r as DialogContent$1, s as DialogTitle$1, t as Dialog$1 } from "../_libs/@radix-ui/react-dialog+[...].mjs";
import { n as toast } from "../_libs/sonner.mjs";
import { a as encodeSourceParam, c as pickActive, i as cn, l as pickExportNodes, n as buildMihomoYaml, o as formatMs, r as buildUriList, s as normalizeSourceUrl, u as sourceNameFromUrl } from "./router-CX07c6yK.mjs";
import { n as TSS_SERVER_FUNCTION, r as getServerFnById, t as createServerFn } from "./ssr.mjs";
import { t as Root } from "../_libs/radix-ui__react-label.mjs";
import { n as SwitchThumb, t as Switch$1 } from "../_libs/radix-ui__react-switch.mjs";
import { i as Trigger, n as List, r as Root2, t as Content } from "../_libs/radix-ui__react-tabs.mjs";
//#region node_modules/.nitro/vite/services/ssr/assets/routes-uW3S1AA2.js
var import_react = /* @__PURE__ */ __toESM(require_react());
var import_jsx_runtime = require_jsx_runtime();
function ConnectDial({ state, node, alive, total, onClick }) {
	const latency = node?.latency ?? null;
	const progress = latency === null ? 0 : Math.max(.12, Math.min(1, 1 - latency / 420));
	const label = state === "scanning" ? "Сканирование" : state === "live" ? "Пул активен" : state === "dead" ? "Нет живых" : "Сканировать";
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("button", {
		type: "button",
		onClick,
		className: cn("group relative mx-auto flex size-52 items-center justify-center rounded-full", "bg-surface shadow-border transition-[transform,box-shadow] duration-fast ease-smooth", "hover:shadow-border-hover active:scale-[0.96] sm:size-56", "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"),
		children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("svg", {
			viewBox: "0 0 120 120",
			className: "absolute inset-3 text-border",
			"aria-hidden": true,
			children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("circle", {
				cx: "60",
				cy: "60",
				r: "52",
				fill: "none",
				stroke: "currentColor",
				strokeWidth: "1.25"
			}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("circle", {
				cx: "60",
				cy: "60",
				r: "52",
				fill: "none",
				stroke: "currentColor",
				className: cn(state === "live" ? "text-live" : "text-fg-subtle", state === "scanning" && "dial-spin origin-center text-fg-muted"),
				strokeWidth: "2.5",
				strokeLinecap: "round",
				strokeDasharray: `${progress * 327} 327`,
				transform: "rotate(-90 60 60)"
			})]
		}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
			className: "relative flex flex-col items-center gap-1 px-6 text-center",
			children: [
				state === "scanning" ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)(LoaderCircle, { className: "mb-1 size-6 animate-spin text-fg-muted" }) : /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { className: cn("mb-1 size-2 rounded-full", state === "live" && "bg-live", state === "dead" && "bg-danger", state === "idle" && "bg-fg-subtle") }),
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
					className: "font-display text-sm font-medium tracking-tight",
					children: label
				}),
				state === "live" && node ? /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(import_jsx_runtime.Fragment, { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", {
					className: "max-w-36 truncate font-mono text-xs text-fg-muted",
					children: [
						node.country ?? "XX",
						" · ",
						node.protocol,
						" · ",
						node.host
					]
				}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
					className: "font-mono text-lg tabular-nums text-fg",
					children: formatMs(latency)
				})] }) : /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", {
					className: "font-mono text-xs tabular-nums text-fg-muted",
					children: [
						alive,
						"/",
						total,
						" живых"
					]
				})
			]
		})]
	});
}
var buttonVariants = cva("inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md text-sm font-medium transition-[opacity,transform,background-color,color,box-shadow] duration-[var(--motion-quick)] ease-[var(--ease-out)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-40 [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0 active:not-disabled:scale-[0.96]", {
	variants: {
		variant: {
			default: "bg-primary text-primary-foreground hover:opacity-90",
			secondary: "bg-surface text-fg shadow-[var(--shadow-border)] hover:shadow-[var(--shadow-border-hover)]",
			ghost: "text-fg-muted hover:bg-surface hover:text-fg",
			outline: "bg-transparent text-fg shadow-[var(--shadow-border)] hover:bg-surface",
			destructive: "bg-danger text-fg hover:opacity-90"
		},
		size: {
			default: "h-11 px-4",
			sm: "h-9 px-3 text-xs",
			lg: "h-12 px-5",
			icon: "size-11"
		}
	},
	defaultVariants: {
		variant: "default",
		size: "default"
	}
});
var Button = import_react.forwardRef(({ className, variant, size, asChild = false, ...props }, ref) => {
	return /* @__PURE__ */ (0, import_jsx_runtime.jsx)(asChild ? Slot : "button", {
		className: cn(buttonVariants({
			variant,
			size,
			className
		})),
		ref,
		...props
	});
});
Button.displayName = "Button";
function ExportPanel({ result, sources }) {
	const [copied, setCopied] = (0, import_react.useState)(null);
	const enabled = sources.filter((s) => s.enabled).map((s) => s.url);
	const subPath = (0, import_react.useMemo)(() => {
		if (enabled.length === 0) return "";
		return `/api/sub?u=${encodeSourceParam(enabled)}&fmt=clash&n=24`;
	}, [enabled]);
	const exportNodes = result ? pickExportNodes(result, 24) : [];
	const yaml = result ? buildMihomoYaml(exportNodes, result.sources) : "";
	const uris = exportNodes.length ? buildUriList(exportNodes) : "";
	async function copy(label, text) {
		if (!text) {
			toast.error("Сначала просканируйте пул");
			return;
		}
		await navigator.clipboard.writeText(text);
		setCopied(label);
		toast.success("Скопировано");
		window.setTimeout(() => setCopied(null), 1500);
	}
	function downloadYaml() {
		if (!yaml) {
			toast.error("Сначала просканируйте пул");
			return;
		}
		const blob = new Blob([yaml], { type: "text/yaml;charset=utf-8" });
		const href = URL.createObjectURL(blob);
		const a = document.createElement("a");
		a.href = href;
		a.download = "relay.yaml";
		a.click();
		URL.revokeObjectURL(href);
	}
	const subUrl = typeof window !== "undefined" && subPath ? `${window.location.origin}${subPath}` : subPath;
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
		className: "space-y-4",
		children: [
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
				className: "rounded-xl bg-surface p-4 shadow-border",
				children: [
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
						className: "text-sm font-medium",
						children: "Живая подписка"
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
						className: "mt-1 text-sm text-fg-muted",
						children: "Вставьте этот URL в Hiddify, Clash Meta или v2rayN. Relay каждый раз заново проверяет списки и отдаёт только живые ноды, равномерно из всех рабочих репозиториев."
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("pre", {
						className: "mt-3 max-h-24 overflow-auto rounded-lg bg-bg-subtle p-3 font-mono text-xs break-all whitespace-pre-wrap text-fg-muted",
						children: subUrl || "Добавьте хотя бы один источник"
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
						className: "mt-3 flex flex-wrap gap-2",
						children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Button, {
							type: "button",
							variant: "secondary",
							onClick: () => copy("sub", subUrl),
							children: [copied === "sub" ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Check, {}) : /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Copy, {}), "Скопировать URL"]
						})
					})
				]
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
				className: "rounded-xl bg-surface p-4 shadow-border",
				children: [
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
						className: "text-sm font-medium",
						children: "Mihomo / Clash Meta"
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
						className: "mt-1 text-sm text-fg-muted",
						children: "Группа AUTO — url-test по самым быстрым. FALLBACK переключает целые источники, если репозиторий молчит. Это то, чего не умеет Hiddify: failover между конфигами, а не только между серверами внутри одного."
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
						className: "mt-3 flex flex-wrap gap-2",
						children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Button, {
							type: "button",
							onClick: downloadYaml,
							children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Download, {}), "Скачать YAML"]
						}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Button, {
							type: "button",
							variant: "secondary",
							onClick: () => copy("uri", uris),
							children: [copied === "uri" ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Check, {}) : /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Copy, {}), "Скопировать URI"]
						})]
					})
				]
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("ol", {
				className: "space-y-2 rounded-xl bg-surface p-4 text-sm text-fg-muted shadow-border",
				children: [
					/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("li", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
						className: "font-medium text-fg",
						children: "1."
					}), " Hiddify: New Profile → Add from clipboard → вставьте URL подписки."] }),
					/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("li", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
						className: "font-medium text-fg",
						children: "2."
					}), " В профиле включите автообновление (1 час) и режим url-test."] }),
					/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("li", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
						className: "font-medium text-fg",
						children: "3."
					}), " Clash Meta / Mihomo: импортируйте YAML. Группа RELAY уже собрана."] })
				]
			})
		]
	});
}
var badgeVariants = cva("inline-flex items-center rounded-full px-2 py-0.5 text-[0.6875rem] font-medium tracking-wide", {
	variants: { variant: {
		default: "bg-surface text-fg-muted shadow-[var(--shadow-border)]",
		live: "bg-live-soft text-live",
		warn: "bg-warn-soft text-warn",
		dead: "bg-danger-soft text-danger",
		proto: "bg-bg-subtle text-fg-muted"
	} },
	defaultVariants: { variant: "default" }
});
function Badge({ className, variant, ...props }) {
	return /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
		className: cn(badgeVariants({ variant }), className),
		...props
	});
}
var Input = import_react.forwardRef(({ className, type, ...props }, ref) => {
	return /* @__PURE__ */ (0, import_jsx_runtime.jsx)("input", {
		type,
		className: cn("flex h-11 w-full rounded-md bg-surface px-3 text-sm text-fg shadow-[var(--shadow-border)] transition-[box-shadow] duration-[var(--motion-quick)] placeholder:text-fg-subtle focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50", className),
		ref,
		...props
	});
});
Input.displayName = "Input";
function PoolPanel({ nodes, activeId, onPick }) {
	const [q, setQ] = (0, import_react.useState)("");
	const filtered = (0, import_react.useMemo)(() => {
		const needle = q.trim().toLowerCase();
		if (!needle) return nodes;
		return nodes.filter((n) => `${n.name} ${n.host} ${n.protocol} ${n.country ?? ""} ${n.sourceName}`.toLowerCase().includes(needle));
	}, [nodes, q]);
	if (nodes.length === 0) return /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
		className: "rounded-xl bg-surface px-4 py-10 text-center text-sm text-fg-muted shadow-border",
		children: "Пул пуст. Запустите сканирование, чтобы проверить списки."
	});
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
		className: "space-y-3",
		children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Input, {
			value: q,
			onChange: (e) => setQ(e.target.value),
			placeholder: "Поиск по стране, хосту, протоколу"
		}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("ul", {
			className: "divide-y divide-border overflow-hidden rounded-xl bg-surface shadow-border",
			children: filtered.map((node) => {
				const selected = node.id === activeId;
				return /* @__PURE__ */ (0, import_jsx_runtime.jsx)("li", { children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("button", {
					type: "button",
					onClick: () => onPick(node),
					className: cn("flex w-full items-center gap-3 px-4 py-3 text-left transition-colors duration-quick", selected ? "bg-bg-subtle" : "hover:bg-bg-subtle/60"),
					children: [
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { className: cn("size-1.5 shrink-0 rounded-full", node.alive ? "bg-live" : "bg-danger") }),
						/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
							className: "min-w-0 flex-1",
							children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
								className: "flex flex-wrap items-center gap-2",
								children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
									className: "font-mono text-xs text-fg-muted",
									children: node.country ?? "XX"
								}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
									className: "truncate text-sm",
									children: node.name
								})]
							}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("p", {
								className: "truncate font-mono text-xs text-fg-subtle",
								children: [
									node.host,
									":",
									node.port,
									" · ",
									node.sourceName
								]
							})]
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
							className: "flex shrink-0 flex-col items-end gap-1",
							children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Badge, {
								variant: "proto",
								children: node.protocol
							}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
								className: cn("font-mono text-xs tabular-nums", node.alive ? "text-fg" : "text-fg-subtle"),
								children: node.alive ? formatMs(node.latency) : "timeout"
							})]
						})
					]
				}) }, node.id);
			})
		})]
	});
}
var Label = import_react.forwardRef(({ className, ...props }, ref) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Root, {
	ref,
	className: cn("text-xs font-medium text-fg-muted", className),
	...props
}));
Label.displayName = Root.displayName;
var Switch = import_react.forwardRef(({ className, ...props }, ref) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Switch$1, {
	className: cn("peer inline-flex h-6 w-10 shrink-0 cursor-pointer items-center rounded-full shadow-[var(--shadow-border)] transition-colors duration-[var(--motion-quick)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50 data-[state=checked]:bg-primary data-[state=unchecked]:bg-bg-subtle", className),
	...props,
	ref,
	children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(SwitchThumb, { className: cn("pointer-events-none block size-5 rounded-full bg-fg transition-transform duration-[var(--motion-quick)] ease-[var(--ease-out)] data-[state=checked]:translate-x-4 data-[state=unchecked]:translate-x-0.5 data-[state=checked]:bg-primary-foreground") })
}));
Switch.displayName = Switch$1.displayName;
function SourcePanel({ sources, scans, onChange }) {
	const [url, setUrl] = (0, import_react.useState)("");
	const [name, setName] = (0, import_react.useState)("");
	function add() {
		try {
			const normalized = normalizeSourceUrl(url);
			if (sources.some((s) => s.url === normalized)) {
				toast.error("Этот список уже добавлен");
				return;
			}
			const id = `src-${Date.now().toString(36)}`;
			onChange([...sources, {
				id,
				name: name.trim() || sourceNameFromUrl(normalized),
				url: normalized,
				enabled: true
			}]);
			setUrl("");
			setName("");
			toast.success("Источник добавлен");
		} catch (err) {
			toast.error(err instanceof Error ? err.message : "Не удалось добавить");
		}
	}
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
		className: "min-w-0 space-y-4",
		children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("form", {
			className: "min-w-0 rounded-xl bg-surface p-4 shadow-border",
			onSubmit: (e) => {
				e.preventDefault();
				add();
			},
			children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
				className: "grid min-w-0 gap-3",
				children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
					className: "grid min-w-0 gap-1.5",
					children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Label, {
						htmlFor: "src-url",
						children: "Адрес списка"
					}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Input, {
						id: "src-url",
						value: url,
						onChange: (e) => setUrl(e.target.value),
						placeholder: "https://raw.githubusercontent.com/…/list.txt",
						autoComplete: "off",
						className: "min-w-0"
					})]
				}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
					className: "flex min-w-0 flex-col gap-3 sm:flex-row",
					children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
						className: "grid min-w-0 flex-1 gap-1.5",
						children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Label, {
							htmlFor: "src-name",
							children: "Имя"
						}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Input, {
							id: "src-name",
							value: name,
							onChange: (e) => setName(e.target.value),
							placeholder: "необязательно",
							className: "min-w-0"
						})]
					}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Button, {
						type: "submit",
						className: "sm:mt-5",
						children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Plus, {}), "Добавить"]
					})]
				})]
			})
		}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("ul", {
			className: "min-w-0 space-y-2",
			children: sources.map((source) => {
				const scan = scans.find((s) => s.id === source.id);
				return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("li", {
					className: "flex min-w-0 flex-col gap-3 overflow-hidden rounded-xl bg-surface p-4 shadow-border sm:flex-row sm:items-center",
					children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
						className: "min-w-0 w-full flex-1 overflow-hidden",
						children: [
							/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
								className: "flex min-w-0 flex-wrap items-center gap-2",
								children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
									className: "truncate font-medium",
									children: source.name
								}), scan ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Badge, {
									variant: !scan.ok ? "dead" : scan.alive > 0 ? "live" : "warn",
									children: !scan.ok ? "недоступен" : scan.alive > 0 ? `${scan.alive} живых` : "тишина"
								}) : /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Badge, { children: "не сканирован" })]
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
								className: "mt-1 truncate font-mono text-xs text-fg-subtle",
								children: source.url
							}),
							scan && scan.ok ? /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("p", {
								className: "mt-1 font-mono text-xs tabular-nums text-fg-muted",
								children: [
									scan.parsed,
									" URI · ",
									scan.unique,
									" адресов · лучший",
									" ",
									formatMs(scan.bestLatency)
								]
							}) : scan?.error ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
								className: "mt-1 text-xs text-danger",
								children: scan.error
							}) : null
						]
					}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
						className: "flex shrink-0 items-center gap-3",
						children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
							className: "flex items-center gap-2",
							children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Switch, {
								checked: source.enabled,
								onCheckedChange: (enabled) => onChange(sources.map((s) => s.id === source.id ? {
									...s,
									enabled
								} : s)),
								"aria-label": "Включить источник"
							}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
								className: "text-xs text-fg-muted",
								children: "в пуле"
							})]
						}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Button, {
							type: "button",
							variant: "ghost",
							size: "icon",
							className: "size-11",
							onClick: () => onChange(sources.filter((s) => s.id !== source.id)),
							"aria-label": "Удалить",
							children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Trash2, {})
						})]
					})]
				}, source.id);
			})
		})]
	});
}
var Dialog = Dialog$1;
var DialogTrigger = DialogTrigger$1;
var DialogPortal = DialogPortal$1;
var DialogOverlay = import_react.forwardRef(({ className, ...props }, ref) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)(DialogOverlay$1, {
	ref,
	className: cn("fixed inset-0 z-50 bg-bg/80", className),
	...props
}));
DialogOverlay.displayName = DialogOverlay$1.displayName;
var DialogContent = import_react.forwardRef(({ className, children, ...props }, ref) => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(DialogPortal, { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(DialogOverlay, {}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(DialogContent$1, {
	ref,
	className: cn("fixed top-1/2 left-1/2 z-50 w-[min(92vw,28rem)] -translate-x-1/2 -translate-y-1/2 rounded-xl bg-surface p-6 shadow-[var(--shadow-border)]", className),
	...props,
	children: [children, /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(DialogClose, {
		className: "absolute top-4 right-4 rounded-md p-1 text-fg-muted hover:text-fg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
		children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(X, { className: "size-4" }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
			className: "sr-only",
			children: "Close"
		})]
	})]
})] }));
DialogContent.displayName = DialogContent$1.displayName;
function DialogHeader({ className, ...props }) {
	return /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
		className: cn("mb-4 space-y-1", className),
		...props
	});
}
function DialogTitle({ className, ...props }) {
	return /* @__PURE__ */ (0, import_jsx_runtime.jsx)(DialogTitle$1, {
		className: cn("font-display text-lg font-medium tracking-tight", className),
		...props
	});
}
function DialogDescription({ className, ...props }) {
	return /* @__PURE__ */ (0, import_jsx_runtime.jsx)(DialogDescription$1, {
		className: cn("text-sm text-fg-muted", className),
		...props
	});
}
var Tabs = Root2;
var TabsList = import_react.forwardRef(({ className, ...props }, ref) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)(List, {
	ref,
	className: cn("flex h-11 w-full min-w-0 items-center gap-1 overflow-x-auto rounded-lg bg-surface p-1 shadow-border", className),
	...props
}));
TabsList.displayName = List.displayName;
var TabsTrigger = import_react.forwardRef(({ className, ...props }, ref) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Trigger, {
	ref,
	className: cn("inline-flex h-9 shrink-0 items-center justify-center rounded-md px-3 text-sm font-medium text-fg-muted transition-[color,background-color] duration-quick hover:text-fg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-50 data-[state=active]:bg-bg-subtle data-[state=active]:text-fg", className),
	...props
}));
TabsTrigger.displayName = Trigger.displayName;
var TabsContent = import_react.forwardRef(({ className, ...props }, ref) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Content, {
	ref,
	className: cn("mt-4 min-w-0 focus-visible:outline-none", className),
	...props
}));
TabsContent.displayName = Content.displayName;
var DEFAULT_SOURCES = [
	{
		id: "bypass-1",
		name: "bypass-1",
		url: "https://raw.githubusercontent.com/whoahaow/rjsxrd/refs/heads/main/githubmirror/bypass/bypass-1.txt",
		enabled: true
	},
	{
		id: "black-mobile",
		name: "black-mobile",
		url: "https://raw.githubusercontent.com/igareck/vpn-configs-for-russia/refs/heads/main/BLACK_VLESS_RUS_mobile.txt",
		enabled: true
	},
	{
		id: "goida-26",
		name: "goida-26",
		url: "https://raw.githubusercontent.com/AvenCores/goida-vpn-configs/main/githubmirror/26.txt",
		enabled: true
	}
];
var STORAGE_KEY = "relay.sources.v1";
var SETTINGS_KEY = "relay.settings.v1";
var createSsrRpc = (functionId) => {
	const url = "/_serverFn/" + functionId;
	const serverFnMeta = { id: functionId };
	const fn = async (...args) => {
		return (await getServerFnById(functionId, { origin: "server" }))(...args);
	};
	return Object.assign(fn, {
		url,
		serverFnMeta,
		[TSS_SERVER_FUNCTION]: true
	});
};
var sourceSchema = object({
	id: string().min(1).max(64),
	name: string().min(1).max(80),
	url: string().min(8).max(500),
	enabled: boolean()
});
var scanSources = createServerFn({ method: "POST" }).validator(object({
	sources: array(sourceSchema).min(1).max(16),
	perSource: number().min(4).max(32).optional(),
	globalCap: number().min(8).max(80).optional(),
	timeoutMs: number().min(800).max(4e3).optional()
})).handler(createSsrRpc("34d3a3363dc01d8ecc2768bf9d57bc6a757f83b85b4b97deed8921c52eb169f3"));
var DEFAULT_SETTINGS = {
	autoRefresh: false,
	strategy: "fastest"
};
function loadSources() {
	try {
		const raw = localStorage.getItem(STORAGE_KEY);
		if (!raw) return DEFAULT_SOURCES;
		const parsed = JSON.parse(raw);
		if (!Array.isArray(parsed) || parsed.length === 0) return DEFAULT_SOURCES;
		return parsed;
	} catch {
		return DEFAULT_SOURCES;
	}
}
function loadSettings() {
	try {
		const raw = localStorage.getItem(SETTINGS_KEY);
		if (!raw) return DEFAULT_SETTINGS;
		return {
			...DEFAULT_SETTINGS,
			...JSON.parse(raw)
		};
	} catch {
		return DEFAULT_SETTINGS;
	}
}
function Dashboard() {
	const [sources, setSources] = (0, import_react.useState)(DEFAULT_SOURCES);
	const [settings, setSettings] = (0, import_react.useState)(DEFAULT_SETTINGS);
	const [result, setResult] = (0, import_react.useState)(null);
	const [active, setActive] = (0, import_react.useState)(null);
	const [persist, setPersist] = (0, import_react.useState)(false);
	const sourcesRef = (0, import_react.useRef)(sources);
	sourcesRef.current = sources;
	(0, import_react.useEffect)(() => {
		setSources(loadSources());
		setSettings(loadSettings());
		setPersist(true);
	}, []);
	(0, import_react.useEffect)(() => {
		if (!persist) return;
		localStorage.setItem(STORAGE_KEY, JSON.stringify(sources));
	}, [sources, persist]);
	(0, import_react.useEffect)(() => {
		if (!persist) return;
		localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
	}, [settings, persist]);
	const scan = useMutation({
		mutationFn: async () => {
			const enabled = sourcesRef.current.filter((s) => s.enabled);
			if (enabled.length === 0) throw new Error("Включите хотя бы один источник");
			return scanSources({ data: {
				sources: enabled,
				perSource: 16,
				globalCap: 64,
				timeoutMs: 2200
			} });
		},
		onSuccess: (data) => {
			setResult(data);
			const next = pickActive(data, settings.strategy, active?.id);
			setActive(next);
			const nAlive = data.nodes.filter((n) => n.alive).length;
			if (nAlive === 0) toast.error("Живых портов не нашлось. Смените списки или повторите.");
			else toast.success(`Пул обновлён · ${nAlive} живых из ${data.nodes.length}`);
		},
		onError: (err) => {
			toast.error(err instanceof Error ? err.message : "Скан не удался");
		}
	});
	(0, import_react.useEffect)(() => {
		if (!settings.autoRefresh) return;
		const id = window.setInterval(() => {
			if (!scan.isPending) scan.mutate();
		}, 18e4);
		return () => window.clearInterval(id);
	}, [settings.autoRefresh, scan.isPending]);
	const alive = result?.nodes.filter((n) => n.alive).length ?? 0;
	const total = result?.nodes.length ?? 0;
	const healthySources = result?.sources.filter((s) => s.ok && s.alive > 0).length ?? 0;
	const dialState = scan.isPending ? "scanning" : result ? alive > 0 ? "live" : "dead" : "idle";
	const strategyLabel = (0, import_react.useMemo)(() => {
		if (settings.strategy === "fallback") return "сначала живой источник";
		if (settings.strategy === "balanced") return "чередование источников";
		return "самый быстрый";
	}, [settings.strategy]);
	function cycleStrategy() {
		const order = [
			"fastest",
			"fallback",
			"balanced"
		];
		const next = order[(order.indexOf(settings.strategy) + 1) % order.length];
		setSettings((s) => ({
			...s,
			strategy: next
		}));
		if (result) setActive(pickActive(result, next, active?.id));
	}
	async function copyActive() {
		if (!active) {
			toast.error("Нет выбранной ноды");
			return;
		}
		await navigator.clipboard.writeText(active.uri);
		toast.success("URI скопирован");
	}
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
		className: "min-h-dvh min-w-0 overflow-x-hidden bg-bg",
		children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("header", {
			className: "mx-auto flex w-full max-w-6xl items-center justify-between px-4 py-4 sm:px-6",
			children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
				className: "flex min-w-0 items-center gap-3",
				children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
					className: "flex size-8 shrink-0 items-center justify-center rounded-md bg-surface shadow-border",
					children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { className: "size-2 rounded-full bg-live" })
				}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
					className: "min-w-0",
					children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
						className: "font-display text-sm font-medium tracking-tight",
						children: "Relay"
					}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
						className: "text-xs text-fg-muted",
						children: "живой пул подписок"
					})]
				})]
			}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Dialog, { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(DialogTrigger, {
				asChild: true,
				children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Button, {
					variant: "ghost",
					size: "icon",
					"aria-label": "Как это работает",
					children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Info, {})
				})
			}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(DialogContent, { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)(DialogHeader, { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(DialogTitle, { children: "Как устроен Relay" }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(DialogDescription, { children: "Браузер не поднимает системный туннель. Relay — это контроллер пула: он тянет публичные списки, проверяет, какие адреса вообще отвечают, и собирает один конфиг, который сам переключает и серверы, и репозитории." })] }), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
				className: "space-y-3 text-sm text-fg-muted",
				children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", { children: "Hiddify умеет url-test внутри одной подписки, но не умеет бросить мёртвый репозиторий и взять другой. В YAML от Relay группа AUTO гоняет url-test по нодам, а FALLBACK ходит по источникам." }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", { children: "Проверка здесь — TCP до порта. Это быстрый фильтр мёртвых IP, не полный handshake REALITY. Финальный отбор скорости делает уже Mihomo / Hiddify." })]
			})] })] })]
		}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("main", {
			className: "mx-auto grid w-full min-w-0 max-w-6xl gap-8 px-4 pb-16 sm:px-6 lg:grid-cols-[minmax(0,18rem)_minmax(0,1fr)] lg:items-start",
			children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("section", {
				className: "stagger-in flex min-w-0 flex-col items-center gap-6 lg:sticky lg:top-8",
				children: [
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)(ConnectDial, {
						state: dialState,
						node: active,
						alive,
						total,
						onClick: () => {
							if (scan.isPending) return;
							if (dialState === "live") copyActive();
							else scan.mutate();
						}
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
						className: "grid w-full grid-cols-3 gap-2 text-center",
						children: [
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Stat, {
								label: "источники",
								value: `${healthySources}/${sources.filter((s) => s.enabled).length}`
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Stat, {
								label: "разобрано",
								value: String(result?.parsedTotal ?? 0)
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Stat, {
								label: "скан",
								value: result ? `${Math.round(result.durationMs / 1e3)} с` : "—"
							})
						]
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
						className: "flex w-full min-w-0 flex-col gap-2",
						children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Button, {
							type: "button",
							onClick: () => scan.mutate(),
							disabled: scan.isPending,
							className: "h-12 w-full",
							children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(RefreshCcw, { className: scan.isPending ? "animate-spin" : "" }), scan.isPending ? "Проверяю списки" : "Обновить пул"]
						}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Button, {
							type: "button",
							variant: "secondary",
							className: "h-12 w-full",
							onClick: copyActive,
							disabled: !active,
							children: "Скопировать активный URI"
						})]
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
						className: "w-full min-w-0 space-y-3 rounded-xl bg-surface p-4 shadow-border",
						children: [
							/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
								className: "flex items-center justify-between gap-3",
								children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
									className: "text-sm font-medium",
									children: "Автообновление"
								}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
									className: "text-xs text-fg-muted",
									children: "каждые 3 минуты"
								})] }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Switch, {
									checked: settings.autoRefresh,
									onCheckedChange: (autoRefresh) => setSettings((s) => ({
										...s,
										autoRefresh
									}))
								})]
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("button", {
								type: "button",
								onClick: cycleStrategy,
								className: "flex min-h-11 w-full items-center justify-between gap-3 rounded-md bg-bg-subtle px-3 py-2 text-left",
								children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
									className: "text-sm",
									children: "Стратегия"
								}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
									className: "text-right text-xs text-fg-muted",
									children: strategyLabel
								})]
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
								className: "text-xs leading-relaxed text-fg-subtle",
								children: active ? `Активная: ${active.country ?? "XX"} ${active.protocol} ${formatMs(active.latency)} · ${active.sourceName}` : "Активной ноды нет — сначала сканируйте."
							})
						]
					})
				]
			}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("section", {
				className: "min-w-0",
				children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Tabs, {
					defaultValue: "sources",
					children: [
						/* @__PURE__ */ (0, import_jsx_runtime.jsxs)(TabsList, { children: [
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)(TabsTrigger, {
								value: "sources",
								children: "Источники"
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)(TabsTrigger, {
								value: "pool",
								children: "Пул"
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)(TabsTrigger, {
								value: "export",
								children: "Экспорт"
							})
						] }),
						/* @__PURE__ */ (0, import_jsx_runtime.jsxs)(TabsContent, {
							value: "sources",
							children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
								className: "mb-4 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between",
								children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
									className: "text-sm text-fg-muted",
									children: "GitHub raw-списки URI. Можно добавить свои."
								}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Button, {
									type: "button",
									variant: "ghost",
									size: "sm",
									onClick: () => setSources(DEFAULT_SOURCES),
									children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(RotateCcw, {}), "Сброс"]
								})]
							}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(SourcePanel, {
								sources,
								scans: result?.sources ?? [],
								onChange: setSources
							})]
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)(TabsContent, {
							value: "pool",
							children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(PoolPanel, {
								nodes: result?.nodes ?? [],
								activeId: active?.id ?? null,
								onPick: (node) => {
									setActive(node);
									toast.message(`Выбрано: ${node.host}:${node.port}`);
								}
							})
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)(TabsContent, {
							value: "export",
							children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(ExportPanel, {
								result,
								sources
							})
						})
					]
				})
			})]
		})]
	});
}
function Stat({ label, value }) {
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
		className: "min-w-0 rounded-lg bg-surface px-1 py-3 shadow-border sm:px-2",
		children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
			className: "truncate font-mono text-sm tabular-nums",
			children: value
		}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
			className: "truncate text-xs text-fg-muted",
			children: label
		})]
	});
}
function Home() {
	return /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Dashboard, {});
}
//#endregion
export { Home as component };
