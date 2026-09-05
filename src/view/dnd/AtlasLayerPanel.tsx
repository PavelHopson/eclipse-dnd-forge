import { Button } from "@nextui-org/react";
import { IoAddOutline, IoEyeOutline, IoEyeOffOutline, IoLockClosedOutline, IoLockOpenOutline, IoArrowUpOutline, IoArrowDownOutline } from "react-icons/io5";
import { atlasLayers, BASE_ATLAS_LAYER_ID, createLivingAtlasId, MAX_ATLAS_LAYERS, shapeLayerId } from "../../model/dnd/livingAtlas";
import type { AtlasLayer, LivingAtlasDocument } from "../../model/dnd/livingAtlas";

export default function AtlasLayerPanel({ document, activeId, selectedCount, onActivate, onChange, onTransfer }: {
    document: LivingAtlasDocument; activeId: string; selectedCount: number;
    onActivate: (id: string) => void; onChange: (layers: AtlasLayer[]) => void; onTransfer: (id: string) => void;
}) {
    const layers = atlasLayers(document);
    const active = layers.find(layer => layer.id === activeId) ?? layers[0];
    const index = layers.indexOf(active);
    const count = (id: string) => document.shapes.filter(shape => shapeLayerId(shape) === id).length;
    const update = (layer: AtlasLayer) => onChange(layers.map(item => item.id === layer.id ? layer : item));
    const reorder = (delta: number) => {
        const next = [...layers];
        [next[index], next[index + delta]] = [next[index + delta], next[index]];
        onChange(next);
    };
    return <section className="atlas-layers" aria-label="Слои карты">
        <div className="atlas-layer-heading"><strong>Слои</strong><span>{layers.length}/{MAX_ATLAS_LAYERS}</span>
            <Button isIconOnly size="sm" variant="light" aria-label="Добавить слой" isDisabled={layers.length >= MAX_ATLAS_LAYERS}
                onClick={() => {
                    const layer = { id: createLivingAtlasId("layer"), name: `Слой ${layers.length + 1}`, visible: true, locked: false };
                    onChange([...layers, layer]); onActivate(layer.id);
                }}><IoAddOutline /></Button>
        </div>
        <div className="atlas-layer-list">
            {[...layers].reverse().map(layer => <div key={layer.id} className={`atlas-layer-row${active.id === layer.id ? " is-active" : ""}`} data-layer-id={layer.id}>
                <button className="atlas-layer-name" aria-pressed={active.id === layer.id} onClick={() => onActivate(layer.id)} title={layer.name}>
                    <span>{layer.name}</span><small>{count(layer.id)}</small>
                </button>
                <Button isIconOnly size="sm" variant="light" aria-label={`${layer.visible ? "Скрыть" : "Показать"} слой ${layer.name}`}
                    onClick={() => update({ ...layer, visible: !layer.visible })}>{layer.visible ? <IoEyeOutline /> : <IoEyeOffOutline />}</Button>
                <Button isIconOnly size="sm" variant="light" aria-label={`${layer.locked ? "Разблокировать" : "Заблокировать"} слой ${layer.name}`}
                    onClick={() => update({ ...layer, locked: !layer.locked })}>{layer.locked ? <IoLockClosedOutline /> : <IoLockOpenOutline />}</Button>
            </div>)}
        </div>
        <label className="atlas-compact-field">Название слоя
            <input key={active.id + active.name} defaultValue={active.name} maxLength={40} onBlur={event => {
                const name = event.target.value.trim();
                if (name && name !== active.name) update({ ...active, name }); else event.target.value = active.name;
            }} onKeyDown={event => { if (event.key === "Enter") event.currentTarget.blur(); }} />
        </label>
        <div className="atlas-layer-order" role="group" aria-label="Порядок активного слоя">
            <Button size="sm" variant="flat" isDisabled={index === layers.length - 1} onClick={() => reorder(1)} startContent={<IoArrowUpOutline />}>Выше</Button>
            <Button size="sm" variant="flat" isDisabled={index === 0} onClick={() => reorder(-1)} startContent={<IoArrowDownOutline />}>Ниже</Button>
        </div>
        {selectedCount > 0 && <label className="atlas-compact-field">Перенести выделенное на слой
            <select value="" onChange={event => onTransfer(event.target.value)}>
                <option value="" disabled>Выберите слой</option>
                {layers.filter(layer => layer.visible && !layer.locked).map(layer => <option key={layer.id} value={layer.id}>{layer.name}</option>)}
            </select>
        </label>}
        {active.id !== BASE_ATLAS_LAYER_ID && <Button size="sm" variant="light" isDisabled={count(active.id) > 0 || active.locked}
            onClick={() => { onChange(layers.filter(layer => layer.id !== active.id)); onActivate(BASE_ATLAS_LAYER_ID); }}>Удалить пустой слой</Button>}
        <p className="atlas-layer-note">PNG — только видимые слои. Файл проекта — все слои.</p>
    </section>;
}
