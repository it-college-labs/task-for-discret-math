import { useEffect, useMemo, useRef, useState } from "react";

const API_BASE = "http://127.0.0.1:8000/api";
const STEP_DURATION = 900;
const NODE_SIZE = 24;
const VERTICAL_GAP = 92;
const HORIZONTAL_UNIT = 64;

const EMPTY_TREE = { rootId: null, nodes: [] };

function buildLayout(tree) {
  if (!tree?.rootId) {
    return { nodes: [], edges: [], width: 640, height: 320 };
  }

  const nodeMap = new Map(tree.nodes.map((node) => [node.id, node]));
  const positions = new Map();
  let index = 0;
  let maxDepth = 0;

  function traverse(nodeId, depth) {
    if (!nodeId) {
      return;
    }
    const node = nodeMap.get(nodeId);
    traverse(node.left, depth + 1);
    positions.set(nodeId, {
      x: 120 + index * HORIZONTAL_UNIT,
      y: 80 + depth * VERTICAL_GAP,
    });
    index += 1;
    maxDepth = Math.max(maxDepth, depth);
    traverse(node.right, depth + 1);
  }

  traverse(tree.rootId, 0);

  const nodes = tree.nodes.map((node) => ({
    ...node,
    x: positions.get(node.id)?.x ?? 0,
    y: positions.get(node.id)?.y ?? 0,
  }));

  const edges = [];
  for (const node of nodes) {
    if (node.left && positions.get(node.left)) {
      edges.push({
        id: `${node.id}-${node.left}`,
        from: positions.get(node.id),
        to: positions.get(node.left),
      });
    }
    if (node.right && positions.get(node.right)) {
      edges.push({
        id: `${node.id}-${node.right}`,
        from: positions.get(node.id),
        to: positions.get(node.right),
      });
    }
  }

  return {
    nodes,
    edges,
    width: Math.max(720, index * HORIZONTAL_UNIT + 160),
    height: Math.max(320, maxDepth * VERTICAL_GAP + 180),
  };
}

async function request(path, options) {
  const response = await fetch(`${API_BASE}${path}`, {
    headers: {
      "Content-Type": "application/json",
    },
    ...options,
  });

  if (!response.ok) {
    const data = await response.json().catch(() => ({ detail: "Request failed" }));
    const error = new Error(data.detail || "Request failed");
    error.payload = data;
    error.status = response.status;
    throw error;
  }

  return response.json();
}

function describeStep(step) {
  switch (step?.type) {
    case "insert_node":
      return "Вставка нового узла";
    case "recolor":
      return "Перекрашивание";
    case "rotate_left":
      return "Левый поворот";
    case "rotate_right":
      return "Правый поворот";
    case "root_recolor":
      return "Перекраска корня";
    default:
      return "Ожидание";
  }
}

export default function App() {
  const [inputValue, setInputValue] = useState("");
  const [tree, setTree] = useState(EMPTY_TREE);
  const [queuedSteps, setQueuedSteps] = useState([]);
  const [currentStepIndex, setCurrentStepIndex] = useState(-1);
  const [isPlaying, setIsPlaying] = useState(false);
  const [error, setError] = useState("");
  const [history, setHistory] = useState([]);
  const [expandedLogKey, setExpandedLogKey] = useState(null);
  const timerRef = useRef(null);

  useEffect(() => {
    request("/tree/export")
      .then((data) => {
        setTree(data.tree);
      })
      .catch((err) => {
        setError(err.message);
      });
  }, []);

  useEffect(() => {
    if (!isPlaying || queuedSteps.length === 0 || currentStepIndex >= queuedSteps.length - 1) {
      return undefined;
    }

    timerRef.current = window.setTimeout(() => {
      const nextIndex = currentStepIndex + 1;
      const nextStep = queuedSteps[nextIndex];
      if (!nextStep) {
        setQueuedSteps([]);
        setCurrentStepIndex(-1);
        setIsPlaying(false);
        return;
      }
      setTree(nextStep.snapshot);
      setCurrentStepIndex(nextIndex);
      if (nextIndex >= queuedSteps.length - 1) {
        window.setTimeout(() => {
          setQueuedSteps([]);
          setCurrentStepIndex(-1);
          setIsPlaying(false);
        }, STEP_DURATION);
      }
    }, STEP_DURATION);

    return () => window.clearTimeout(timerRef.current);
  }, [isPlaying, queuedSteps, currentStepIndex]);

  const currentStep = currentStepIndex >= 0 ? queuedSteps[currentStepIndex] : null;
  const layout = useMemo(() => buildLayout(tree), [tree]);

  async function handleInsert(event) {
    event.preventDefault();
    const parsed = Number(inputValue);
    if (!Number.isInteger(parsed)) {
      setError("Введите целое число.");
      return;
    }

    setError("");
    window.clearTimeout(timerRef.current);
    setQueuedSteps([]);
    setCurrentStepIndex(-1);
    setIsPlaying(false);

    try {
      const data = await request("/tree/insert", {
        method: "POST",
        body: JSON.stringify({ value: parsed }),
      });
      setTree(data.steps[0]?.snapshot ?? data.tree);
      setQueuedSteps(data.steps);
      setCurrentStepIndex(data.steps.length ? 0 : -1);
      setIsPlaying(data.steps.length > 0);
      setHistory((prev) => [
        {
          key: `insert-${Date.now()}`,
          summary: `insert ${data.insertedValue} -> ${data.steps.map((step) => step.type).join(", ")}`,
          raw: {
            timestamp: new Date().toLocaleTimeString("ru-RU"),
            method: "POST",
            path: "/tree/insert",
            status: 200,
            payload: data,
          },
        },
        ...prev.slice(0, 5),
      ]);
      setInputValue("");
    } catch (err) {
      setError(err.message);
      setHistory((prev) => [
        {
          key: `insert-error-${Date.now()}`,
          summary: `insert ${parsed} -> error ${err.status || 500}`,
          raw: {
            timestamp: new Date().toLocaleTimeString("ru-RU"),
            method: "POST",
            path: "/tree/insert",
            status: err.status || 500,
            payload: err.payload || { detail: err.message },
          },
        },
        ...prev.slice(0, 5),
      ]);
    }
  }

  async function handleReset() {
    window.clearTimeout(timerRef.current);
    setQueuedSteps([]);
    setCurrentStepIndex(-1);
    setIsPlaying(false);
    setError("");

    try {
      const data = await request("/tree/reset", { method: "POST" });
      setTree(data.tree);
      setHistory((prev) => [
        {
          key: `reset-${Date.now()}`,
          summary: "reset",
          raw: {
            timestamp: new Date().toLocaleTimeString("ru-RU"),
            method: "POST",
            path: "/tree/reset",
            status: 200,
            payload: data,
          },
        },
        ...prev.slice(0, 5),
      ]);
    } catch (err) {
      setError(err.message);
      setHistory((prev) => [
        {
          key: `reset-error-${Date.now()}`,
          summary: `reset -> error ${err.status || 500}`,
          raw: {
            timestamp: new Date().toLocaleTimeString("ru-RU"),
            method: "POST",
            path: "/tree/reset",
            status: err.status || 500,
            payload: err.payload || { detail: err.message },
          },
        },
        ...prev.slice(0, 5),
      ]);
    }
  }

  const highlightedIds = new Set(currentStep?.affectedNodeIds ?? []);

  return (
    <main className="app-shell">
      <section className="hero">
        <h1>Задача Дискретная математика</h1>
        <p className="lead">
          Вводите числа, смотрите повороты и перекрашивания по шагам. Один источник истины
          для структуры и анимации приходит с сервера.
        </p>
      </section>

      <section className="panel controls">
        <form onSubmit={handleInsert} className="controls-form">
          <label className="field">
            <span>ЧИСЛО</span>
            <input
              value={inputValue}
              onChange={(event) => setInputValue(event.target.value)}
              placeholder="например 42"
              inputMode="numeric"
            />
          </label>
          <button type="submit">ДОБАВИТЬ</button>
          <button type="button" className="secondary" onClick={handleReset}>
            СБРОСИТЬ
          </button>
        </form>
        <div className="status-grid">
          <div className="status-card">
            <span>ТЕКУЩИЙ ШАГ</span>
            <strong>{currentStep ? describeStep(currentStep) : "Нет активной анимации"}</strong>
          </div>
          <div className="status-card">
            <span>ПОДСВЕТКА</span>
            <strong>{highlightedIds.size ? [...highlightedIds].join(", ") : "Нет"}</strong>
          </div>
          <div className="status-card">
            <span>ОШИБКА</span>
            <strong>{error || "Нет"}</strong>
          </div>
        </div>
      </section>

      <section className="panel visualizer">
        <div className="canvas-header">
          <h2>Tree Canvas</h2>
          <p>{tree.nodes.length} nodes</p>
        </div>
        <div className="canvas-wrap">
          <svg
            viewBox={`0 0 ${layout.width} ${layout.height}`}
            className="tree-canvas"
            role="img"
            aria-label="Красно-чёрное дерево"
          >
            <defs>
              <pattern id="grid" width="40" height="40" patternUnits="userSpaceOnUse">
                <path d="M 40 0 L 0 0 0 40" fill="none" stroke="rgba(0,0,0,0.07)" strokeWidth="1" />
              </pattern>
            </defs>
            <rect width={layout.width} height={layout.height} fill="url(#grid)" />
            {layout.edges.map((edge) => (
              <line
                key={edge.id}
                x1={edge.from.x}
                y1={edge.from.y}
                x2={edge.to.x}
                y2={edge.to.y}
                className="edge"
              />
            ))}
            {layout.nodes.map((node) => (
              <g
                key={node.id}
                className={[
                  "node",
                  `node-${node.color}`,
                  highlightedIds.has(node.id) ? "node-highlight" : "",
                ].join(" ")}
                transform={`translate(${node.x}, ${node.y})`}
              >
                <rect x={-NODE_SIZE} y={-NODE_SIZE} width={NODE_SIZE * 2} height={NODE_SIZE * 2} />
                <text y="6" textAnchor="middle">
                  {node.value}
                </text>
                <text y="42" textAnchor="middle" className="node-id">
                  {node.id}
                </text>
              </g>
            ))}
            {!layout.nodes.length && (
              <text x="50%" y="50%" textAnchor="middle" className="empty-state">
                TREE IS EMPTY
              </text>
            )}
          </svg>
        </div>
      </section>

      <section className="panel log-panel">
        <div className="canvas-header">
          <h2>Operation Log</h2>
          <p>Последние действия</p>
        </div>
        <ul className="log-list">
          {history.length === 0 && <li>Лог пуст.</li>}
          {history.map((item) => (
            <li key={item.key} className="log-item">
              <div className="log-row">
                <span>{item.summary}</span>
                <button
                  type="button"
                  className="log-detail-button"
                  onClick={() =>
                    setExpandedLogKey((prev) => (prev === item.key ? null : item.key))
                  }
                >
                  {expandedLogKey === item.key ? "СКРЫТЬ JSON" : "ДЕТАЛИ"}
                </button>
              </div>
              {expandedLogKey === item.key && (
                <pre className="raw-entry">{JSON.stringify(item.raw, null, 2)}</pre>
              )}
            </li>
          ))}
        </ul>
      </section>
    </main>
  );
}
