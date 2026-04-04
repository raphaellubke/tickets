'use client';

import { useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { useAuth } from '@/context/AuthContext';
import AuthModal from '@/components/AuthModal/AuthModal';
import styles from './Header.module.css';

export default function Header() {
    const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);
    const { user } = useAuth();

    return (
        <>
            <header className={styles.header}>
                <div className={styles.container}>
                    <Link href="/" className={styles.logo}>
                        <Image
                            src="/logo.png"
                            alt="Missão Guadalupe"
                            height={44}
                            width={160}
                            style={{ objectFit: 'contain', height: '44px', width: 'auto' }}
                            priority
                        />
                    </Link>


                    <div className={styles.searchContainer}>
                        <input
                            type="text"
                            placeholder="Busque um evento, igreja, local..."
                            className={styles.searchInput}
                        />
                        <button className={styles.searchButton}>
                            🔍
                        </button>
                    </div>

                    <div className={styles.actions}>
                        <Link href="/dashboard" className={styles.createEvent}>
                            <span className={styles.createIcon}>+</span>
                            Crie seu evento
                        </Link>
                        {user ? (
                            <Link href="/profile" className={styles.profileButton}>
                                <span className={styles.profileIcon}>👤</span>
                                Meu Perfil
                            </Link>
                        ) : (
                            <button 
                                onClick={() => setIsAuthModalOpen(true)}
                                className={styles.loginButton}
                            >
                                Entrar ou cadastrar
                            </button>
                        )}
                    </div>
                </div>
            </header>
            <AuthModal 
                isOpen={isAuthModalOpen} 
                onClose={() => setIsAuthModalOpen(false)} 
            />
        </>
    );
}
