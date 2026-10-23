// A round price sticker, styled after the labels on Pastry Universe packaging:
// orange ring, thin white ring, charcoal centre.
export default function Sticker({ top, children, size = 'sm', className = '' }) {
  return (
    <span className={`sticker sticker-${size} ${className}`}>
      {top && <span className="sticker-top">{top}</span>}
      <span className="sticker-main">{children}</span>
    </span>
  );
}
