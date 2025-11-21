import Header from '@/components/Header/Header';
import styles from './page.module.css';

export default function CreateEvent() {
    return (
        <main className={styles.main}>
            <Header />
            <div className={styles.container}>
                <h1 className={styles.title}>Criar Novo Evento</h1>
                <form className={styles.form}>
                    <div className={styles.formGroup}>
                        <label htmlFor="title" className={styles.label}>Nome do Evento</label>
                        <input type="text" id="title" className={styles.input} placeholder="Ex: Culto de Ação de Graças" />
                    </div>

                    <div className={styles.row}>
                        <div className={styles.formGroup}>
                            <label htmlFor="date" className={styles.label}>Data</label>
                            <input type="date" id="date" className={styles.input} />
                        </div>
                        <div className={styles.formGroup}>
                            <label htmlFor="time" className={styles.label}>Horário</label>
                            <input type="time" id="time" className={styles.input} />
                        </div>
                    </div>

                    <div className={styles.formGroup}>
                        <label htmlFor="location" className={styles.label}>Local</label>
                        <input type="text" id="location" className={styles.input} placeholder="Ex: Igreja Central" />
                    </div>

                    <div className={styles.formGroup}>
                        <label htmlFor="category" className={styles.label}>Categoria</label>
                        <select id="category" className={styles.select}>
                            <option value="">Selecione uma categoria</option>
                            <option value="culto">Culto</option>
                            <option value="workshop">Workshop</option>
                            <option value="show">Show/Concerto</option>
                            <option value="retiro">Retiro/Acampamento</option>
                            <option value="outro">Outro</option>
                        </select>
                    </div>

                    <div className={styles.formGroup}>
                        <label htmlFor="price" className={styles.label}>Preço (R$)</label>
                        <input type="number" id="price" className={styles.input} placeholder="0,00" min="0" step="0.01" />
                    </div>

                    <div className={styles.formGroup}>
                        <label htmlFor="description" className={styles.label}>Descrição</label>
                        <textarea id="description" className={styles.textarea} rows={5} placeholder="Descreva os detalhes do evento..."></textarea>
                    </div>

                    <button type="submit" className={styles.submitButton}>Criar Evento</button>
                </form>
            </div>
        </main>
    );
}
