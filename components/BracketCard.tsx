import React from "react";

interface BracketCardProps {
    children: React.ReactNode;
    className?: string;
    style?: React.CSSProperties;
}

const BracketCard: React.FC<BracketCardProps> = ({ children, className = "", style = {} }) => (
    <div className={`bracket-box bg-surface p-6 ${className}`} style={style}>
        {children}
    </div>
);

export default BracketCard;
