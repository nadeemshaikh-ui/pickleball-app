export default function DecorativeBackground() {
  return (
    <div className="deco-bg" aria-hidden="true">
      <span className="deco deco-diamond" style={{ top: '6%', left: '4%' }} />
      <span className="deco deco-diamond deco-sm" style={{ top: '14%', left: '10%' }} />
      <span className="deco deco-chevron" style={{ top: '10%', right: '6%' }}>&lt;&lt;&lt;</span>
      <span className="deco deco-chevron" style={{ top: '40%', left: '2%' }}>&lt;&lt;&lt;</span>
      <span className="deco deco-chevron" style={{ bottom: '18%', right: '4%' }}>&gt;&gt;&gt;</span>
      <span className="deco deco-dots" style={{ top: '24%', right: '12%' }}>····</span>
      <span className="deco deco-dots" style={{ bottom: '30%', left: '8%' }}>····</span>
      <span className="deco deco-diamond deco-sm" style={{ bottom: '10%', right: '20%' }} />
      <span className="deco deco-plus" style={{ bottom: '6%', left: '30%' }}>+</span>
    </div>
  );
}
