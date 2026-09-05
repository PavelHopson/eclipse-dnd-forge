export default function CampaignLoadError() {
    return <main className="dnd-route-loading">
        <h1>Не удалось открыть кампанию</h1>
        <p role="alert">Кампания уже редактируется в другой вкладке, данные повреждены или браузер запретил безопасное хранение. Закройте другую вкладку с этим миром и попробуйте снова. Сохранённые файлы не перезаписаны.</p>
        <button onClick={() => { window.location.hash = "/"; window.location.reload(); }}>К списку кампаний и резервным копиям</button>
    </main>;
}
