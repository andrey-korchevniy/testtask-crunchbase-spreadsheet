//* вешаем слушатель на кнопку и обрабатываем нажатие
const getBtn = document.getElementById('getBtn');
getBtn.addEventListener('click', () => {
  chrome.tabs.query({ active: true }, function (tabs) {
    const tab = tabs[0];
    // проверяем, на нужном ли сайте запущено расширение
    if (tab.url.includes('crunchbase.com/discover')) {
      chrome.scripting.executeScript(
        {
          target: { tabId: tab.id, allFrames: false },
          func: grabTable,
        },
        onResult
      );
    } else {
      alert('This is not a crunchbase website');
    }
  });
});

//* -----> по нажатию кнопки делаем выборку данных и формируем массив объектов с компаниями
function grabTable() {
  //* -----> получаем шапку таблицы
  const data = document.querySelectorAll(
    'grid-column-header[data-columnid] > div > div'
  );
  const headers = Array.from(data).map(data => data.innerText);
  if (headers && headers.length > 0) headers.unshift('Num'); // добавляем номерацию на первую позицию

  //* -----> получаем данные о компаниях
  const tableData = []; // заготовка массива с данными из таблицы
  const myElements = Array.from(document.querySelectorAll('grid-cell *')) // стучимся в таблицу
    .filter(el => el.innerText && el.children.length === 0) // выбираем все бездетные элементы с текстом
    .map(el => {
      const text = el.innerText;
      if (text.slice(0, 1) === ' ') {
        tableData[tableData.length - 1] =
          tableData[tableData.length - 1] + ',' + text; // если первый символ элемента пробел, то клеим его к предыдущему через запятую
      } else {
        tableData.push(text); // иначе добавляем как самостоятельный элемент
      }
    });

  //* -----> создаем массив объектов данных по компаниям
  const objData = []; // массив объектов для передачи гугл таблицам
  headers.forEach((el, index) => (objData[0] = { ...objData[0], [index]: el })); // для начала заполняем массив шапкой таблицы

  let key = 0; // счетчик строк (компаний), по сути определяет число объектов в массиве
  let marker = 0; // счетчик для столбцов, определяет имя поля объекта. важно для размещения в googlesheet
  tableData.forEach(el => {
    if (el === String.fromCharCode(160)) {
      marker = 0;
      key += 1;
    } else {
      objData[key] = {
        ...objData[key],
        [marker]: el,
      };
      marker += 1;
    }
  });

  return objData;
}

//* -----> отправка данных в таблицу
function onResult(frames) {
  // Если результатов нет
  if (!frames || !frames.length) {
    alert('Could not retrieve table data from this page');
    return;
  }
  // Объеденям списки URL из фреймов в один массив (если они в разных фреймах)
  const dataForPost = frames
    .map(frame => frame.result)
    .reduce((r1, r2) => r1.concat(r2));

  //* -----> стираем предыдущий результат
  fetch(
    'https://api.apispreadsheets.com/data/mH8kI6Uqm3YGjsyN/?query=delete *',
    {
      method: 'GET',
    }
  ).then(res => {
    //* -----> записываем актуальные данные
    if (res.status === 200) {
      // открываем таблицу
      window.open(
        'https://docs.google.com/spreadsheets/d/1pqGP9EiMHC3IjXcEEVwXLdMA-N37qzQ9JAqbxpXdhcw/edit#gid=0',
        '_blank'
      );
      fetch('https://api.apispreadsheets.com/data/mH8kI6Uqm3YGjsyN/', {
        method: 'POST',
        body: JSON.stringify({ data: dataForPost }),
      }).then(res => {
        if (res.status === 201) {
          window.close();
        } else {
          console.log('Writing error');
        }
      });
    } else {
      console.log('Deleting error');
    }
  });
}
