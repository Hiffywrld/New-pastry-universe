import { artFor, defaultSizeKey } from '../menu/art.js';
import { formatNaira } from '../lib/format.js';
import Sticker from './Sticker.jsx';

/** A tappable card on the menu. While its treat is in the spotlight, the photo is "lifted" out of it. */
export default function MenuCard({ item, lifted, onOpen }) {
  const art = artFor(item, defaultSizeKey(item));
  return (
    <button
      type="button"
      data-treat={item.id}
      className={`menu-card${item.inStock ? '' : ' is-out'}${lifted ? ' is-lifted' : ''}`}
      onClick={() => onOpen(item)}
    >
      <span className="menu-card-art">
        {art.src && <img src={art.src} alt="" loading="lazy" className={art.cutout ? '' : 'photo'} draggable="false" />}
        {item.tag && <span className="tag menu-card-tag">{item.tag}</span>}
        <Sticker top="from" className="menu-card-sticker">
          {item.priceMin >= 1000 ? `₦${(item.priceMin / 1000).toFixed(item.priceMin % 1000 ? 1 : 0)}k` : formatNaira(item.priceMin)}
        </Sticker>
      </span>
      <span className="menu-card-body">
        <span className="menu-card-name">{item.name}</span>
        <span className="muted small">
          {item.inStock
            ? item.sizes.length > 1
              ? `${item.sizes.length} sizes · from ${formatNaira(item.priceMin)}`
              : formatNaira(item.priceMin)
            : 'Sold out'}
        </span>
      </span>
    </button>
  );
}
