import { Check, ChevronDown } from "lucide-react";
import {
  useEffect,
  useId,
  useRef,
  useState,
  type KeyboardEvent,
  type ReactNode,
} from "react";

export type DropdownOption = { value: string; label: string };

// 브라우저 기본 select 목록은 CSS로 꾸밀 수 없어서, 카드 스타일에 맞춘 목록을 직접 그린다.
// 포커스는 버튼에 두고 aria-activedescendant로 현재 항목을 알린다.
export default function Dropdown({
  value,
  options,
  onChange,
  label,
  className = "",
  triggerClassName = "dropdown-trigger",
  children,
}: {
  value: string;
  options: DropdownOption[];
  onChange: (value: string) => void;
  label: string;
  className?: string;
  triggerClassName?: string;
  children?: ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const [up, setUp] = useState(false);
  const [active, setActive] = useState(0);
  const root = useRef<HTMLDivElement>(null);
  const listId = useId();
  const selectedIndex = Math.max(
    0,
    options.findIndex((o) => o.value === value),
  );
  const selected = options[selectedIndex];

  useEffect(() => {
    if (!open) return;
    const close = (e: PointerEvent) => {
      if (!root.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("pointerdown", close);
    return () => document.removeEventListener("pointerdown", close);
  }, [open]);

  function show() {
    // 기본은 아래로 펼치고, 아래 공간이 모자랄 때만 위로 펼친다.
    const rect = root.current!.getBoundingClientRect();
    const below = window.innerHeight - rect.bottom;
    setUp(below < options.length * 38 + 24 && rect.top > below);
    setActive(selectedIndex);
    setOpen(true);
  }
  function choose(index: number) {
    onChange(options[index].value);
    setOpen(false);
  }
  function onKeyDown(e: KeyboardEvent) {
    const keys = ["ArrowDown", "ArrowUp", "Enter", " ", "Home", "End"];
    if (!open) {
      if (keys.includes(e.key)) {
        e.preventDefault();
        show();
      }
      return;
    }
    const last = options.length - 1;
    if (e.key === "Escape" || e.key === "Tab") {
      setOpen(false);
      return;
    }
    if (!keys.includes(e.key)) return;
    e.preventDefault();
    if (e.key === "ArrowDown") setActive((i) => (i === last ? 0 : i + 1));
    if (e.key === "ArrowUp") setActive((i) => (i === 0 ? last : i - 1));
    if (e.key === "Home") setActive(0);
    if (e.key === "End") setActive(last);
    if (e.key === "Enter" || e.key === " ") choose(active);
  }

  return (
    <div ref={root} className={`dropdown ${className}`}>
      <button
        type="button"
        className={triggerClassName}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={open ? listId : undefined}
        aria-activedescendant={open ? `${listId}-${active}` : undefined}
        aria-label={`${label}: ${selected?.label ?? ""}`}
        onClick={() => (open ? setOpen(false) : show())}
        onKeyDown={onKeyDown}
      >
        {children ?? <span>{selected?.label}</span>}
        <ChevronDown size={14} className="dropdown-chevron" />
      </button>
      {open && (
        <ul
          id={listId}
          role="listbox"
          aria-label={label}
          className={up ? "dropdown-menu up" : "dropdown-menu"}
        >
          {options.map((o, i) => (
            <li
              key={o.value}
              id={`${listId}-${i}`}
              role="option"
              aria-selected={o.value === value}
              className={i === active ? "active" : undefined}
              onPointerEnter={() => setActive(i)}
              onClick={() => choose(i)}
            >
              {o.label}
              {o.value === value && <Check size={14} />}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
