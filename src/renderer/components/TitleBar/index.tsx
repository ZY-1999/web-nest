import { ThemeToggle } from '../ThemeToggle';

export function TitleBar() {
  return (
    <div className="app-titlebar">
      <div className="titlebar-left">
        <img src="./icon.png" alt="" className="ml-2 h-5 w-5" draggable={false} />
      </div>
      <div className="titlebar-center">web-nest</div>
      <div className="titlebar-right">
        <ThemeToggle />
      </div>
    </div>
  );
}
