import { Link } from 'react-router-dom';
import { Brand } from '../components/Brand';

export default function NotFound() {
  return (
    <div className="simple-page">
      <div className="app-bg" />
      <Brand />
      <div className="simple-card">
        <p className="stage-kicker">404 · 走错教学楼了</p>
        <h1 className="display">这间教室不存在</h1>
        <p>你可能摸到了空教室，核对一下链接，或者直接回首页重新进场。</p>
        <Link className="btn btn-sun" to="/">回首页</Link>
      </div>
    </div>
  );
}
