'use client';

import { useState, useRef, useEffect } from 'react';
import styles from './DropdownMenu.module.css';

interface DropdownOption {
    label: string;
    icon?: React.ReactNode;
    onClick: () => void;
    danger?: boolean;
}

interface DropdownMenuProps {
    options: DropdownOption[];
    children: React.ReactNode;
}

export default function DropdownMenu({ options, children }: DropdownMenuProps) {
    const [isOpen, setIsOpen] = useState(false);
    const dropdownRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        function handleClickOutside(event: MouseEvent) {
            if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
                setIsOpen(false);
            }
        }

        if (isOpen) {
            document.addEventListener('mousedown', handleClickOutside);
        }

        return () => {
            document.removeEventListener('mousedown', handleClickOutside);
        };
    }, [isOpen]);

    return (
        <div className={styles.dropdown} ref={dropdownRef}>
            <div
                className={styles.trigger}
                onClick={(e) => {
                    e.stopPropagation();
                    setIsOpen(!isOpen);
                }}
            >
                {children}
            </div>
            {isOpen && (
                <div className={styles.menu}>
                    {options.map((option, index) => (
                        <button
                            key={index}
                            className={`${styles.menuItem} ${option.danger ? styles.danger : ''}`}
                            onClick={(e) => {
                                e.stopPropagation();
                                option.onClick();
                                setIsOpen(false);
                            }}
                        >
                            {option.icon && <span className={styles.icon}>{option.icon}</span>}
                            <span>{option.label}</span>
                        </button>
                    ))}
                </div>
            )}
        </div>
    );
}

