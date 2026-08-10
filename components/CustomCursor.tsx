"use client";

import { useEffect, useRef, useState } from "react";

const CustomCursor = () => {
    const cursorDot = useRef<HTMLDivElement>(null);
    const cursorOutline = useRef<HTMLDivElement>(null);
    const mouse = useRef({ x: -100, y: -100 });
    const trailing = useRef({ x: -100, y: -100 });
    const isHoveringRef = useRef(false);
    const [isHovering, setIsHovering] = useState(false);
    const [isVisible, setIsVisible] = useState(false);
    const hasMoved = useRef(false);

    useEffect(() => {
        // Disable on touch devices
        if (window.matchMedia("(pointer: coarse)").matches) return;

        let animationFrameId: number;

        const onMouseMove = (e: MouseEvent) => {
            if (!hasMoved.current) {
                hasMoved.current = true;
                setIsVisible(true);
                mouse.current = { x: e.clientX, y: e.clientY };
                trailing.current = { x: e.clientX, y: e.clientY };
            } else {
                mouse.current = { x: e.clientX, y: e.clientY };
            }

            if (cursorDot.current) {
                cursorDot.current.style.transform = `translate3d(${e.clientX}px, ${e.clientY}px, 0) translate(-50%, -50%)`;
            }

            const target = e.target as Element | null;
            const hovering = !!(
                target && 
                target.closest('button, a, input, select, textarea, .bracket-box, .cursor-pointer, [role="button"], [data-rk] button, [data-rk] a, [data-rk] [role="button"]')
            );
            if (hovering !== isHoveringRef.current) {
                isHoveringRef.current = hovering;
                setIsHovering(hovering);
            }
        };

        const renderLoop = () => {
            // Smoothly interpolate trailing position towards mouse position
            trailing.current.x += (mouse.current.x - trailing.current.x) * 0.2;
            trailing.current.y += (mouse.current.y - trailing.current.y) * 0.2;

            if (cursorOutline.current) {
                const scale = isHoveringRef.current ? 1.5 : 1;
                cursorOutline.current.style.transform = `translate3d(${trailing.current.x}px, ${trailing.current.y}px, 0) translate(-50%, -50%) scale(${scale})`;
            }
            animationFrameId = requestAnimationFrame(renderLoop);
        };

        window.addEventListener('mousemove', onMouseMove, { passive: true });
        animationFrameId = requestAnimationFrame(renderLoop);

        return () => {
            window.removeEventListener('mousemove', onMouseMove);
            cancelAnimationFrame(animationFrameId);
        };
    }, []);

    if (!isVisible) return null;

    return (
        <div className="pointer-events-none fixed inset-0 overflow-hidden" style={{ zIndex: 2147483647 }}>
            <div 
                ref={cursorDot} 
                className="fixed top-0 left-0 w-2 h-2 bg-neon rounded-full pointer-events-none"
                style={{ willChange: 'transform', zIndex: 2147483647 }}
            />
            <div 
                ref={cursorOutline} 
                className={`fixed top-0 left-0 w-8 h-8 rounded-full pointer-events-none transition-colors duration-200 ease-out flex items-center justify-center ${
                    isHovering ? 'border border-neon bg-neon/10' : 'border border-textMuted/40'
                }`}
                style={{ willChange: 'transform', zIndex: 2147483647 }}
            />
        </div>
    );
};

export default CustomCursor;
