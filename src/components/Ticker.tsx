const DEFAULT = [
  '床铺郑重声明：再睡五分钟属于大学生基本人权',
  '教务处温馨辟谣：没有这项权利',
  '早八广播：概率点名模式，全班翘得越狠，老师点名手越痒',
  '温馨提示：倒计时结束还在犹豫的，一律按睡过头翘课算',
  '情报速递：点名率低到一定程度，连早起自律人也会选择翘课',
  '今日气象：被窝局部恒温 26℃，教室前排风力三级',
  '每局重新抽签投胎，上一局是卷王，下一局可能变床神',
];

export function Ticker({ items = DEFAULT }: { items?: string[] }) {
  const doubled = [...items, ...items];
  return (
    <div className="ticker" aria-hidden="true">
      <div className="ticker-track">
        {doubled.map((item, i) => (
          <span key={i}>{item}</span>
        ))}
      </div>
    </div>
  );
}
