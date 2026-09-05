import { useEffect, useRef, type ReactNode } from "react";
import { createPortal } from "react-dom";

/** Portal escapes React Flow's transformed/clipped canvas; background cannot steal focus or shortcuts. */
export default function MapWorkspaceDialog({ children, onClose }: { children: ReactNode; onClose: () => void }) {
    const root = useRef<HTMLDivElement>(null);
    useEffect(() => {
        const previousFocus = document.activeElement as HTMLElement | null;
        const previousOverflow = document.body.style.overflow;
        const background = [...document.body.children].filter((node): node is HTMLElement => node instanceof HTMLElement && node !== root.current);
        const previousInert = background.map((node) => node.inert);
        background.forEach((node) => { node.inert = true; });
        document.body.style.overflow = "hidden";
        root.current?.focus();
        return () => {
            background.forEach((node, index) => { node.inert = previousInert[index]; });
            document.body.style.overflow = previousOverflow;
            if (previousFocus?.isConnected) previousFocus.focus();
        };
    }, []);
    return createPortal(<div ref={root} className="map-workspace-root" role="dialog" aria-modal="true" aria-label="Карты кампании" tabIndex={-1}
        onKeyDown={(event) => {
            event.stopPropagation();
            if (event.key === "Escape") { event.preventDefault(); onClose(); }
            if (event.key !== "Tab") return;
            const controls = [...event.currentTarget.querySelectorAll<HTMLElement>('button:not([disabled]), input:not([disabled]):not([type=hidden]), select:not([disabled]), textarea:not([disabled]), a[href], summary, [tabindex="0"]')]
                .filter((node) => node.getClientRects().length > 0);
            const first = controls[0], last = controls[controls.length - 1];
            if (!first) { event.preventDefault(); return; }
            if (event.shiftKey && (document.activeElement === first || document.activeElement === root.current)) { event.preventDefault(); last.focus(); }
            else if (!event.shiftKey && (document.activeElement === last || document.activeElement === root.current)) { event.preventDefault(); first.focus(); }
        }}>{children}</div>, document.body);
}
