import { showStatus } from "./utils.js";
import { parseMarkup } from "./parser.js";
import { renderDiagram, redrawConnections } from "./renderer.js";

let currentDiagram = {};

let scale = 1;
let isDragging = false;
let dragOffset = { x: 0, y: 0 };

window.zoomIn = function () {
  scale = Math.min(scale * 1.2, 3);
  updateZoom();
};

window.zoomOut = function () {
  scale = Math.max(scale / 1.2, 0.3);
  updateZoom();
};

window.resetZoom = function () {
  scale = 1;
  updateZoom();
};

function updateZoom() {
  const diagramArea = document.getElementById("diagram-area");
  const connections = document.getElementById("connections");
  const zoomLevel = document.getElementById("zoom-level");

  diagramArea.style.transform = `scale(${scale})`;
  connections.style.transform = `scale(${scale})`;

  zoomLevel.textContent = `${Math.round(scale * 100)}%`;
}

// Инициализация при загрузке
window.addEventListener("DOMContentLoaded", () => {
  document
    .getElementById("generate-btn")
    .addEventListener("click", generateDiagram);
  document
    .getElementById("auto-layout-btn")
    .addEventListener("click", autoLayout);

  generateDiagram();

  const diagramContainer = document.getElementById("diagram-container");
  diagramContainer.addEventListener(
    "wheel",
    function (e) {
      if (e.ctrlKey) {
        e.preventDefault();
        if (e.deltaY < 0) {
          zoomIn();
        } else {
          zoomOut();
        }
      }
    },
    { passive: false },
  );
});

let currentEntity = null;
function makeDraggable(element, entity) {
  element.addEventListener("mousedown", startDrag);

  function startDrag(e) {
    if (e.button !== 0) return;

    e.preventDefault();
    e.stopPropagation();

    isDragging = true;
    currentEntity = entity;

    const rect = element.getBoundingClientRect();
    dragOffset.x = e.clientX - rect.left;
    dragOffset.y = e.clientY - rect.top;

    element.classList.add("dragging");

    document.addEventListener("mousemove", onDrag);
    document.addEventListener("mouseup", stopDrag);
  }

  function onDrag(e) {
    if (!isDragging || !currentEntity) return;

    const diagramArea = document.getElementById("diagram-area");
    const diagramRect = diagramArea.getBoundingClientRect();

    let newX = e.clientX - dragOffset.x - diagramRect.left;
    let newY = e.clientY - dragOffset.y - diagramRect.top;

    // Ограничиваем область перетаскивания
    newX = Math.max(
      0,
      Math.min(newX, diagramArea.offsetWidth - element.offsetWidth),
    );
    newY = Math.max(
      0,
      Math.min(newY, diagramArea.offsetHeight - element.offsetHeight),
    );

    element.style.left = `${newX}px`;
    element.style.top = `${newY}px`;

    currentEntity.x = newX;
    currentEntity.y = newY;

    redrawConnections(currentDiagram);
  }

  function stopDrag() {
    if (!isDragging) return;

    element.classList.remove("dragging");
    isDragging = false;
    currentEntity = null;

    document.removeEventListener("mousemove", onDrag);
    document.removeEventListener("mouseup", stopDrag);
  }
}

// Функция генерации диаграммы
window.generateDiagram = function () {
  try {
    const markup = document.getElementById("markup").value;
    const { entities, relationships, generalizations } = parseMarkup(markup);
    renderDiagram({ entities, relationships, generalizations });
    currentDiagram = { entities, relationships, generalizations };
    entities.forEach((ent) => makeDraggable(ent.div, ent));
    autoLayout();
    showStatus("Диаграмма успешно создана!", "success");
  } catch (error) {
    showStatus(`Ошибка: ${error.message}`, "error");
    console.error(error);
  }
};

// Функция авторазмещения
window.autoLayout = function () {
  const { entities, relationships, generalizations } = currentDiagram;
  // Используем простую сетку для размещения
  const cols = Math.ceil(Math.sqrt(entities.length));
  const padding = 150;
  const entityWidth = 200;
  const entityHeight = 200;

  entities.forEach((entity, index) => {
    const col = index % cols;
    const row = Math.floor(index / cols);

    const x = padding + col * (entityWidth + padding);
    const y = padding + row * (entityHeight + padding);

    entity.x = x;
    entity.y = y;

    if (entity.div) {
      entity.div.style.left = `${x}px`;
      entity.div.style.top = `${y}px`;
    }
  });

  redrawConnections(currentDiagram);
  showStatus("Элементы автоматически размещены", "success");
};

// Функция загрузки примера
window.loadExample = function () {
  document.getElementById("markup").value = `
Entity Book {
  +ISBN: string
  title: string
  ?year: number
  category_id: number FK -> Category.id
}

Entity Category {
  +id: number
  name: string
}

Entity Person {
  +name: string
}

Entity Student {
  +name: string
}

Entity Employee {
  +name: string
} 

Generalization Person {
  Student
  Employee
} complete discriminator=Role
`;

  showStatus('Пример загружен. Нажмите "Сгенерировать диаграмму"', "success");
};
