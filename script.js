// Глобальные переменные
let entities = [];
let relationships = [];
let generalizations = [];
let svg = null;
let isDragging = false;
let currentEntity = null;
let dragOffset = { x: 0, y: 0 };
let scale = 1;

// Парсер
function parseMarkup(markup) {
  entities = [];
  relationships = [];
  generalizations = [];

  const lines = markup.split("\n").map((line) => line.trim());
  let currentEntity = null;

  for (let i = 0; i < lines.length; i++) {
    let line = lines[i];

    if (line.startsWith("#") || line === "") continue;

    if (line.startsWith("[") && line.endsWith("]")) {
      const entityName = line.substring(1, line.length - 1);
      currentEntity = {
        name: entityName,
        weak: false,
        pk: [],
        attrs: [],
        div: null,
        x: 0,
        y: 0,
        width: 0,
        height: 0,
      };
      entities.push(currentEntity);
      continue;
    }

    if (currentEntity && line.includes(":")) {
      const parts = line.split(":").map((p) => p.trim());
      const attrName = parts[0];
      const type = parts[1] || "string";
      const modifiers = parts.slice(0,  2).join(":");
      console.log("modifiers", modifiers);

      const optional = line.includes("(O)");
      const isPK = modifiers.includes("PK");
      console.log(attrName, isPK);
      const isFK = modifiers.includes("FK");
      let fkTarget = null;

      if (isFK) {
        const fkMatch = modifiers.match(/FK\s*->\s*([^.]+)\.(.+)/);
        if (fkMatch) {
          fkTarget = {
            entity: fkMatch[1],
            attribute: fkMatch[2],
          };
          // Если есть FK, сущность слабая
          currentEntity.weak = true;
        }
      }

      const attr = {
        name: attrName.replace(" (O)", ""),
        type,
        optional,
        isPK,
        isFK,
        fkTarget,
      };

      if (isPK) {
        currentEntity.pk.push(attr);
      } else {
        currentEntity.attrs.push(attr);
      }

      continue;
    }

    if (line.includes("--")) {
      const parts = line.split("--").map((p) => p.trim());
      if (parts.length === 2) {
        const [sourcePart, targetPart] = parts;
        const sourceMatch = sourcePart.match(/([^.]+)\.(.+)/);
        const targetMatch = targetPart.match(/([^.]+)\.(.+)/);

        if (sourceMatch && targetMatch) {
          relationships.push({
            source: {
              entity: sourceMatch[1],
              attribute: sourceMatch[2],
            },
            target: {
              entity: targetMatch[1],
              attribute: targetMatch[2],
            },
          });
        }
      }
      continue;
    }

    if (line.includes("(обобщение)")) {
      const entityName = line.split("(")[0].trim();
      let categories = [];
      let discriminator = "";
      let complete = false;

      let j = i + 1;
      while (j < lines.length && !lines[j].includes("}")) {
        if (lines[j].includes("{")) {
          j++;
          continue;
        }
        categories.push(
          ...lines[j]
            .split(" ")
            .map((c) => c.trim())
            .filter((c) => c && c !== "{"),
        );
        j++;
      }

      j++;

      if (j < lines.length && lines[j].includes(":")) {
        const props = lines[j].split(":")[1].trim();
        complete = props.includes("полная");
        const discMatch = props.match(/дискриминатор=([^ ,]+)/);
        if (discMatch) discriminator = discMatch[1];
      }

      generalizations.push({
        generic: entityName,
        categories: categories.filter((c) => c),
        discriminator,
        complete,
        symbol: null,
      });

      i = j;
    }
  }
}

// Функция генерации диаграммы
window.generateDiagram = function () {
  try {
    const markup = document.getElementById("markup").value;
    parseMarkup(markup);
    renderDiagram();
    autoLayout();
    showStatus("Диаграмма успешно создана!", "success");
  } catch (error) {
    showStatus(`Ошибка: ${error.message}`, "error");
    console.error(error);
  }
};

// Функция авторазмещения
window.autoLayout = function () {
  const diagramArea = document.getElementById("diagram-area");

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

  redrawConnections();
  showStatus("Элементы автоматически размещены", "success");
};

// Функция загрузки примера
window.loadExample = function () {
  document.getElementById("markup").value = `# IDEF1X Диаграмма - Библиотека

# Сущности
[Книга]
ISBN: PK
Название: string
Автор: string
Год_издания: number
Категория_ID: FK -> Категория.ID

[Категория]
ID: PK
Название: string
Описание: string (O)

[Читатель]
ID: PK
ФИО: string
Телефон: string
Email: string (O)

[Выдача]
ID: PK
Книга_ISBN: FK -> Книга.ISBN
Читатель_ID: FK -> Читатель.ID
Дата_выдачи: date
Дата_возврата: date (O)
Статус: string

# Связи
Книга.Категория_ID -- Категория.ID
Выдача.Книга_ISBN -- Книга.ISBN
Выдача.Читатель_ID -- Читатель.ID

# Генерализации
Сотрудник (обобщение) {
  Библиотекарь
  Администратор
  Техник
} : полная, дискриминатор=Должность`;

  showStatus('Пример загружен. Нажмите "Сгенерировать диаграмму"', "success");
};

function renderDiagram() {
  const diagramArea = document.getElementById("diagram-area");
  const connections = document.getElementById("connections");

  diagramArea.innerHTML = "";
  connections.innerHTML = "";

  svg = connections;

  // Рендерим сущности
  entities.forEach((entity) => {
    // Создаем контейнер для сущности
    const container = document.createElement("div");
    container.className = `entity-container ${entity.weak ? "weak-entity" : "strong-entity"}`;
    container.style.left = `${entity.x}px`;
    container.style.top = `${entity.y}px`;

    // Название сущности НАД прямоугольником
    const nameDiv = document.createElement("div");
    nameDiv.className = "entity-name";
    nameDiv.textContent = entity.name;
    container.appendChild(nameDiv);

    // Внутренний контейнер для содержимого
    const contentDiv = document.createElement("div");
    contentDiv.className = "entity-box";

    // Секция первичных ключей
    const pkSection = document.createElement("div");
    pkSection.className = "pk-section";

    entity.pk.forEach((pk) => {
      const attrDiv = document.createElement("div");
      attrDiv.className = "pk-attribute";
      const pkSpan = document.createElement("span");
      pkSpan.className = "pk";
      pkSpan.textContent = pk.name;
      attrDiv.appendChild(pkSpan);

      const typeSpan = document.createElement("span");
      typeSpan.className = "attribute-type";
      typeSpan.textContent = `: ${pk.type}`;
      attrDiv.appendChild(typeSpan);

      pkSection.appendChild(attrDiv);
    });

    contentDiv.appendChild(pkSection);

    // Разделительная линия (без точек)
    if (entity.pk.length > 0 || entity.attrs.length > 0) {
      const separator = document.createElement("div");
      separator.className = "separator";
      contentDiv.appendChild(separator);
    }

    // Секция остальных атрибутов
    const attrsSection = document.createElement("div");
    attrsSection.className = "attributes-section";

    entity.attrs.forEach((attr) => {
      const attrDiv = document.createElement("div");
      attrDiv.className = `attribute ${attr.optional ? "optional" : ""}`;

      const nameSpan = document.createElement("span");
      nameSpan.textContent = attr.name + (attr.optional ? " (O)" : "");
      attrDiv.appendChild(nameSpan);

      const typeSpan = document.createElement("span");
      typeSpan.className = "attribute-type";
      typeSpan.textContent = `: ${attr.type}`;
      attrDiv.appendChild(typeSpan);

      attrsSection.appendChild(attrDiv);
    });

    contentDiv.appendChild(attrsSection);
    container.appendChild(contentDiv);
    diagramArea.appendChild(container);

    // Сохраняем ссылку и рассчитываем размеры
    entity.div = container;

    // Рассчитываем размеры сущности
    calculateEntitySize(entity);

    makeDraggable(container, entity);
  });

  // Рисуем связи и генерализации
  drawConnections();
}

function calculateEntitySize(entity) {
  const nameDiv = entity.div.querySelector(".entity-name");

  // Рассчитываем ширину на основе самого длинного атрибута
  let maxWidth = 0;

  // Проверяем ширину названия
  const tempName = document.createElement("span");
  tempName.style.visibility = "hidden";
  tempName.style.position = "absolute";
  tempName.style.fontSize = "14px";
  tempName.style.fontWeight = "bold";
  tempName.textContent = entity.name;
  document.body.appendChild(tempName);
  maxWidth = Math.max(maxWidth, tempName.offsetWidth);
  document.body.removeChild(tempName);

  // Проверяем ширину атрибутов
  const allAttrs = [...entity.pk, ...entity.attrs];
  allAttrs.forEach((attr) => {
    const tempAttr = document.createElement("span");
    tempAttr.style.visibility = "hidden";
    tempAttr.style.position = "absolute";
    tempAttr.style.fontSize = "12px";
    tempAttr.textContent = `${attr.name}: ${attr.type}`;
    document.body.appendChild(tempAttr);
    maxWidth = Math.max(maxWidth, tempAttr.offsetWidth);
    document.body.removeChild(tempAttr);
  });

  // Устанавливаем ширину с отступами
  entity.width = Math.max(150, maxWidth + 30); // Минимальная ширина 150px
  entity.div.style.width = `${entity.width}px`;

  // Центрируем название
  nameDiv.style.width = `${entity.width}px`;
}

function drawConnections() {
  // Рисуем связи между сущностями
  relationships.forEach((rel) => {
    const sourceEntity = entities.find((e) => e.name === rel.source.entity);
    const targetEntity = entities.find((e) => e.name === rel.target.entity);

    if (
      !sourceEntity ||
      !targetEntity ||
      !sourceEntity.div ||
      !targetEntity.div
    )
      return;

    // Получаем точки соединения на границах сущностей
    const sourcePoint = getConnectionPoint(sourceEntity, targetEntity);
    const targetPoint = getConnectionPoint(targetEntity, sourceEntity);

    // Проверяем на NaN значения
    if (
      isNaN(sourcePoint.x) ||
      isNaN(sourcePoint.y) ||
      isNaN(targetPoint.x) ||
      isNaN(targetPoint.y)
    ) {
      console.warn("Invalid connection points:", sourcePoint, targetPoint);
      return;
    }

    // Определяем тип связи (идентифицирующая/неидентифицирующая)
    const isIdentifying = targetEntity.pk.some(
      (pk) =>
        pk.isFK &&
        pk.fkTarget &&
        pk.fkTarget.entity === sourceEntity.name &&
        pk.fkTarget.attribute === rel.source.attribute,
    );

    // Рисуем линию
    drawLine(sourcePoint, targetPoint, isIdentifying);

    // Добавляем символы кардинальности
    drawRelationshipSymbols(targetPoint, isIdentifying);
  });

  // Рисуем генерализации
  drawGeneralizations();
}

function getConnectionPoint(fromEntity, toEntity) {
  const fromRect = fromEntity.div.getBoundingClientRect();
  const toRect = toEntity.div.getBoundingClientRect();
  const diagramArea = document.getElementById("diagram-area");
  const diagramRect = diagramArea.getBoundingClientRect();

  // Центры сущностей
  const fromCenterX = fromRect.left + fromRect.width / 2 - diagramRect.left;
  const fromCenterY = fromRect.top + fromRect.height / 2 - diagramRect.top;
  const toCenterX = toRect.left + toRect.width / 2 - diagramRect.left;
  const toCenterY = toRect.top + toRect.height / 2 - diagramRect.top;

  // Вектор направления
  const dx = toCenterX - fromCenterX;
  const dy = toCenterY - fromCenterY;

  // Находим точку на границе fromEntity
  let pointX, pointY;

  if (Math.abs(dx) > Math.abs(dy)) {
    // Горизонтальное направление преобладает
    pointX = fromCenterX + (dx > 0 ? fromRect.width / 2 : -fromRect.width / 2);
    pointY = fromCenterY + (fromRect.height / 2) * (dy / Math.abs(dx));
  } else {
    // Вертикальное направление преобладает
    pointY =
      fromCenterY + (dy > 0 ? fromRect.height / 2 : -fromRect.height / 2);
    pointX = fromCenterX + (fromRect.width / 2) * (dx / Math.abs(dy));
  }

  // Корректируем для получения точки на границе
  const borderOffset = 1;
  if (Math.abs(dx) > Math.abs(dy)) {
    pointX += dx > 0 ? -borderOffset : borderOffset;
  } else {
    pointY += dy > 0 ? -borderOffset : borderOffset;
  }

  return { x: pointX, y: pointY };
}

function drawLine(startPoint, endPoint, isIdentifying) {
  // Рисуем ортогональную линию
  const path = document.createElementNS("http://www.w3.org/2000/svg", "path");

  // Создаем путь с изгибом
  const dx = endPoint.x - startPoint.x;
  const dy = endPoint.y - startPoint.y;

  let d;
  if (Math.abs(dx) > Math.abs(dy)) {
    // Горизонтальное направление
    const midX = startPoint.x + dx / 2;
    d = `M ${startPoint.x} ${startPoint.y} 
                     H ${midX} 
                     V ${endPoint.y} 
                     H ${endPoint.x}`;
  } else {
    // Вертикальное направление
    const midY = startPoint.y + dy / 2;
    d = `M ${startPoint.x} ${startPoint.y} 
                     V ${midY} 
                     H ${endPoint.x} 
                     V ${endPoint.y}`;
  }

  path.setAttribute("d", d);
  path.setAttribute(
    "class",
    `relationship-line ${isIdentifying ? "identifying-line" : "non-identifying-line"}`,
  );
  svg.appendChild(path);

  // Добавляем стрелку или точку на конце
  if (!isIdentifying) {
    // Точка для неидентифицирующей связи
    const dot = document.createElementNS(
      "http://www.w3.org/2000/svg",
      "circle",
    );
    dot.setAttribute("cx", endPoint.x);
    dot.setAttribute("cy", endPoint.y);
    dot.setAttribute("r", 4);
    dot.setAttribute("class", "cardinality-dot");
    svg.appendChild(dot);
  } else {
    // Стрелка для идентифицирующей связи
    const arrow = document.createElementNS(
      "http://www.w3.org/2000/svg",
      "polygon",
    );
    const arrowSize = 8;
    const angle = Math.atan2(
      endPoint.y - startPoint.y,
      endPoint.x - startPoint.x,
    );

    const x1 = endPoint.x - arrowSize * Math.cos(angle - Math.PI / 6);
    const y1 = endPoint.y - arrowSize * Math.sin(angle - Math.PI / 6);
    const x2 = endPoint.x - arrowSize * Math.cos(angle + Math.PI / 6);
    const y2 = endPoint.y - arrowSize * Math.sin(angle + Math.PI / 6);

    arrow.setAttribute(
      "points",
      `${endPoint.x},${endPoint.y} ${x1},${y1} ${x2},${y2}`,
    );
    arrow.setAttribute("class", "arrow");
    svg.appendChild(arrow);
  }
}

function drawRelationshipSymbols(point, isIdentifying) {
  // Добавляем обозначение кардинальности
  const text = document.createElementNS("http://www.w3.org/2000/svg", "text");
  text.setAttribute("x", point.x + 8);
  text.setAttribute("y", point.y + 5);
  text.setAttribute("class", "cardinality-label");
  text.textContent = isIdentifying ? "1" : "P";
  svg.appendChild(text);
}

function drawGeneralizations() {
  generalizations.forEach((gen) => {
    const generic = entities.find((e) => e.name === gen.generic);
    if (!generic || !generic.div) return;

    const genericRect = generic.div.getBoundingClientRect();
    const diagramArea = document.getElementById("diagram-area");
    const diagramRect = diagramArea.getBoundingClientRect();

    const centerX = genericRect.left + genericRect.width / 2 - diagramRect.left;
    const centerY = genericRect.top + genericRect.height - diagramRect.top;

    // Круг генерализации
    const circle = document.createElementNS(
      "http://www.w3.org/2000/svg",
      "circle",
    );
    circle.setAttribute("cx", centerX);
    circle.setAttribute("cy", centerY + 30);
    circle.setAttribute("r", 8);
    circle.setAttribute("class", "generalization-circle");
    svg.appendChild(circle);

    // Линия под кругом
    const underline = document.createElementNS(
      "http://www.w3.org/2000/svg",
      "line",
    );
    underline.setAttribute("x1", centerX - 8);
    underline.setAttribute("y1", centerY + 38);
    underline.setAttribute("x2", centerX + 8);
    underline.setAttribute("y2", centerY + 38);
    underline.setAttribute("stroke", "black");
    underline.setAttribute("stroke-width", "2");
    svg.appendChild(underline);

    if (gen.complete) {
      const underline2 = document.createElementNS(
        "http://www.w3.org/2000/svg",
        "line",
      );
      underline2.setAttribute("x1", centerX - 8);
      underline2.setAttribute("y1", centerY + 42);
      underline2.setAttribute("x2", centerX + 8);
      underline2.setAttribute("y2", centerY + 42);
      underline2.setAttribute("stroke", "black");
      underline2.setAttribute("stroke-width", "2");
      svg.appendChild(underline2);
    }

    // Дискриминатор
    if (gen.discriminator) {
      const text = document.createElementNS(
        "http://www.w3.org/2000/svg",
        "text",
      );
      text.setAttribute("x", centerX);
      text.setAttribute("y", centerY + 34);
      text.setAttribute("text-anchor", "middle");
      text.setAttribute("font-size", "11");
      text.textContent = gen.discriminator;
      svg.appendChild(text);
    }

    // Линии к категориям
    gen.categories.forEach((catName) => {
      const cat = entities.find((e) => e.name === catName);
      if (cat && cat.div) {
        const catRect = cat.div.getBoundingClientRect();
        const catPoint = {
          x: catRect.left + catRect.width / 2 - diagramRect.left,
          y: catRect.top - diagramRect.top,
        };

        // Рисуем линию от круга к категории
        const line = document.createElementNS(
          "http://www.w3.org/2000/svg",
          "path",
        );
        line.setAttribute(
          "d",
          `M ${centerX} ${centerY + 30} L ${catPoint.x} ${catPoint.y}`,
        );
        line.setAttribute("stroke", "black");
        line.setAttribute("stroke-width", "2");
        line.setAttribute("fill", "none");
        svg.appendChild(line);
      }
    });
  });
}

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

    redrawConnections();
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

function redrawConnections() {
  const connections = document.getElementById("connections");
  connections.innerHTML = "";
  svg = connections;
  drawConnections();
}

function showStatus(message, type) {
  const statusDiv = document.getElementById("status");
  statusDiv.textContent = message;
  statusDiv.className = `status ${type}`;
  statusDiv.style.display = "block";

  setTimeout(() => {
    statusDiv.style.display = "none";
  }, 3000);
}

// Zoom функции
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
