export default function DecorativeBackground() {
  return (
    <div className="deco-bg" aria-hidden="true">
      <span className="deco deco-diamond-outline" style={{ top: '5%', left: '3%' }} />
      <span className="deco deco-diamond-outline deco-sm" style={{ top: '13%', left: '9%' }} />
      <span className="deco deco-chevron" style={{ top: '9%', right: '5%' }}>&lt;&lt;&lt;</span>
      <span className="deco deco-chevron" style={{ top: '38%', left: '2%' }}>&lt;&lt;&lt;</span>
      <span className="deco deco-chevron" style={{ bottom: '20%', right: '3%' }}>&gt;&gt;&gt;</span>
      <span className="deco deco-chevron" style={{ top: '60%', right: '2%' }}>&gt;&gt;&gt;</span>
      <span className="deco deco-squares" style={{ top: '22%', right: '11%' }}>▪▪▪</span>
      <span className="deco deco-squares" style={{ bottom: '32%', left: '7%' }}>▪▪▪</span>
      <span className="deco deco-dashes" style={{ top: '30%', left: '14%' }} />
      <span className="deco deco-dashes" style={{ bottom: '14%', right: '16%' }} />
      <span className="deco deco-diamond-outline deco-sm" style={{ bottom: '9%', right: '22%' }} />
      <span className="deco deco-plus" style={{ bottom: '5%', left: '28%' }}>+</span>
      <span className="deco deco-plus" style={{ top: '46%', right: '30%' }}>+</span>
    </div>
  );
}
