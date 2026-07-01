import { useRef } from 'react';
import { Languages } from 'lucide-react';
import { useTypingMode } from '../../contexts/TypingModeContext';
import { krutidevToUnicode } from '../../utils/krutidevToUnicode';

// Cycles through the three supported typing modes.
const MODES = ['mangal', 'krutidev', 'english'];
const MODE_LABEL = { mangal: 'मंगल', krutidev: 'कृतिदेव', english: 'EN' };

function ModeToggle({ localMode, setLocalMode }) {
  const cycle = () => {
    const idx = MODES.indexOf(localMode);
    setLocalMode(MODES[(idx + 1) % MODES.length]);
  };
  return (
    <button
      type="button"
      onClick={cycle}
      title="टाइपिंग मोड बदलें (मंगल / कृतिदेव / EN)"
      tabIndex={-1}
      className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center gap-1 px-1.5 py-0.5 rounded-md text-[10px] font-mono font-semibold bg-ink-100 dark:bg-white/10 text-ink-500 dark:text-ink-300 hover:bg-ink-200 dark:hover:bg-white/20 select-none z-10"
    >
      <Languages className="w-3 h-3" />
      {MODE_LABEL[localMode]}
    </button>
  );
}

// Drop-in replacement for a text <input>. Forwards all normal props
// (value, onChange, placeholder, className, etc.) unchanged so it doesn't
// affect form logic/validation/state - it only augments how keystrokes turn
// into characters when the KrutiDev typing mode is active, and applies the
// Mangal font when Hindi typing modes are active.
export function HindiInput({ value, onChange, className = '', style, useGlobalMode = true, ...props }) {
  const { mode: globalMode } = useTypingMode();
  const localRef = useRef(globalMode);
  const mode = useGlobalMode ? globalMode : localRef.current;

  const handleChange = (e) => {
    if (mode === 'krutidev') {
      const converted = krutidevToUnicode(e.target.value);
      onChange?.({ ...e, target: { ...e.target, value: converted, name: e.target.name } });
    } else {
      onChange?.(e);
    }
  };

  const fontClass = mode !== 'english' ? 'font-hindi' : '';

  return (
    <input
      {...props}
      value={value}
      onChange={handleChange}
      className={`${className} ${fontClass}`}
      style={style}
    />
  );
}

export function HindiTextarea({ value, onChange, className = '', style, useGlobalMode = true, ...props }) {
  const { mode: globalMode } = useTypingMode();
  const mode = useGlobalMode ? globalMode : globalMode;

  const handleChange = (e) => {
    if (mode === 'krutidev') {
      const converted = krutidevToUnicode(e.target.value);
      onChange?.({ ...e, target: { ...e.target, value: converted, name: e.target.name } });
    } else {
      onChange?.(e);
    }
  };

  const fontClass = mode !== 'english' ? 'font-hindi' : '';

  return (
    <textarea
      {...props}
      value={value}
      onChange={handleChange}
      className={`${className} ${fontClass}`}
      style={style}
    />
  );
}

export default HindiInput;
