var storedData = [];

function initCookie() {
  chrome.tabs.query(
    {
      status: "complete",
      windowId: chrome.windows.WINDOW_ID_CURRENT,
      active: true,
    },
    function (tab) {
      chrome.cookies.getAll({ name: "UserID" }, function (cookie) {
        sessionStorage.setItem("MSV", cookie[0].value);
        update();
      });
    }
  );
}

window.onload = () => {
  initCookie();

  document.getElementById("switch-tab").addEventListener("click", (e) => {
    document.getElementById("tab-container-search").style.display = "block";
    document.getElementById("tab-container-main").style.display = "none";
    document.getElementById("search").click();
  });

  document.getElementById("switch-tab-back").addEventListener("click", () => {
    document.getElementById("tab-container-search").style.display = "none";
    document.getElementById("tab-container-main").style.display = "block";
  });

  document
    .getElementById("show-full-slot")
    .addEventListener("change", function () {
      document.getElementById("search").click();
    });

  var node = document.getElementById("startButton");
  node.addEventListener("click", function () {
    node.disabled = true;
    initDataTable();
    update();
    doWork();
  });

  document.getElementById("stopButton").addEventListener("click", () => {
    clearStoreData();
    update();

    document.getElementById("startButton").disabled = false;
  });

  document.getElementById("search").addEventListener("click", () => {
    var details = {
      ddlMonHoc: "1",
      txtSearch: document.getElementById("subjectSearchInput").value,
      btnTim: "Tìm kiếm",
    };

    var formBody = [];
    for (var property in details) {
      var encodedKey = encodeURIComponent(property);
      var encodedValue = encodeURIComponent(details[property]);
      formBody.push(encodedKey + "=" + encodedValue);
    }
    formBody = formBody.join("&");

    fetch("https://tinchi.neu.edu.vn/TraCuuHocPhan", {
      method: "POST",
      body: formBody,
      headers: {
        "Content-type": "application/x-www-form-urlencoded;charset=UTF-8",
      },
    })
      .then((response) => {
        return response.text();
      })
      .then(async (res) => {
        var tempDiv = document.createElement("div");

        var startIndex = res.indexOf('<table class="table table-hover">');
        var endIndex = res.indexOf("</table>");

        tempDiv.innerHTML = res.substring(startIndex, endIndex);

        var data = [];

        var query = tempDiv.querySelectorAll(".trhover");
        for (var i = 0; i < query.length; i++) {
          var tr = query[i];
          var trQuery = tr.querySelectorAll("td");

          var object = [];

          for (var j = 0; j < trQuery.length; j++) {
            object.push(trQuery[j].innerText);
          }

          data.push(object);
        }

        console.log(data);

        var dataTable = `
        <table>
          <tr style="font-size: 12pt">
            <th>Môn học</th>
            <th>Thông tin</th>
            <th>Giảng viên</th>
            <th>Slot trống</th>
            <th style="width: 100px;">Trạng thái</th>
          </tr>
          %placeholder%
        </table>
        `;

        var placeholder = "";

        for (var i = 0; i < data.length; i++) {
          var obj = data[i];

          if (
            !document.getElementById("show-full-slot").checked &&
            parseInt(obj[10]) <= 0
          )
            continue;

          var action = await checkScheduleStatus(obj[5]);
          if (action == "OK") {
            var added =
              storedData.filter((data) => data[0] == obj[1]).length != 0;
            action = `<div class="add-class"><button id="${
              obj[1]
            }" data-meta="${obj[2]}%%${obj[5]}%%${
              obj[6].length == 0 ? "?" : obj[6]
            }%%${obj[10]}" ${added ? "disabled" : ""}>${
              !added ? "Thêm" : "Đã thêm"
            }</button></div>`;
          }

          placeholder =
            placeholder +
            `
          <tr>
            <td>${obj[2]}</td>
            <td>${obj[5]}</td>
            <td>${obj[6].length == 0 ? "?" : obj[6]}</td>
            <td>${obj[10]}</td>
            <td style="${
              action.startsWith("Trùng lịch")
                ? "background-color: red; color: white;"
                : ""
            }">${action}</td>
          </tr>
          `;
        }

        document.getElementById("searchResult").innerHTML = dataTable.replace(
          "%placeholder%",
          placeholder
        );

        var addClassButtons = document.querySelectorAll(".add-class");
        for (var i = 0; i < addClassButtons.length; i++) {
          var button = addClassButtons[i].querySelectorAll("button")[0];

          button.onclick = function (event) {
            var currentButton = event.target; // Lưu trữ giá trị của button được nhấn
            var metadata = currentButton.getAttribute("data-meta").split("%%");
            if (currentButton.innerHTML == "Đã thêm") return;
            addStoreData([currentButton.id, metadata]);
            currentButton.innerHTML = "Đã thêm";
            updateUI();
          };
        }
      });
  });
};

async function getCurrentTab() {
  let queryOptions = { active: true, lastFocusedWindow: true };
  let [tab] = await chrome.tabs.query(queryOptions);
  return tab;
}

function initUI() {
  document.getElementById("url-not-valid").style.display = "none";
  document.getElementById("root").style.display = "block";

  document.getElementById("msv").textContent =
    "Xin chào " + sessionStorage.getItem("MSV") + ",";

  updateUI();
}

function updateUI() {
  var parsedData = JSON.parse(localStorage.getItem("subject-stored-data"));
  if (parsedData == null) return;
  var selectedTableHTML = `
    <table>
      <tr style="font-size: 12pt">
        <th>Lớp học phần</th>
        <th>Tên học phần</th>
        <th>Thông tin</th>
        <th>Giảng viên</th>
        <th>Slot trống</th>
        <th>Hành động</th>
      </tr>
      %placeholder%
    </table>
  `;

  var placeholder = ``;
  for (var i = 0; i < parsedData.length; i++) {
    var metadata = parsedData[i][1];
    placeholder += `
      <tr>
        <td>${parsedData[i][0]}</td>
        <td>${metadata[0]}</td>
        <td>${metadata[1]}</td>
        <td>${metadata[2]}</td>
        <td>${metadata[3]}</td>
        <td><button id="${parsedData[i][0]}" class="delete-class">Xoá</button></td>
      </tr>
    `;
  }

  var selectedTable = document.getElementById("selectedClassesTable");
  selectedTable.innerHTML = selectedTableHTML.replace(
    "%placeholder%",
    placeholder
  );

  var query = document.querySelectorAll(".delete-class");
  for (var i = 0; i < query.length; i++) {
    query[i].onclick = function (event) {
      var currentBtn = event.target;
      removeStoreData(currentBtn.id);
      updateUI();
    };
  }
}

function initDataTable() {
  var table = document.getElementById("dataTable");

  if (storedData.length == 0) {
    table.innerHTML =
      '<tr style="font-size: 12pt;"><th>Lớp học phần</th><th>Trạng thái</th></tr>';
    return;
  }

  storedData
    .map((v) => v[0])
    .forEach((data) => {
      var html =
        "<tr><td>" +
        data +
        "</td><td id='" +
        data +
        "_status'>Đang tải</td></tr>";
      table.innerHTML = table.innerHTML + html;
    });
}

function loadStoredData() {
  storedData = JSON.parse(localStorage.getItem("subject-stored-data"));
  if (storedData == null || storedData == undefined) {
    storedData = [];
  }
}

function addStoreData(data) {
  storedData.push(data);
  localStorage.setItem("subject-stored-data", JSON.stringify(storedData));
}

function clearStoreData() {
  if (storedData.length > 0) storedData.length = 0;
  localStorage.removeItem("subject-stored-data");
}

function removeStoreData(data) {
  storedData = storedData.filter(function (item) {
    return item[0] !== data;
  });
  localStorage.setItem("subject-stored-data", JSON.stringify(storedData));
  initDataTable();
}

function update() {
  getCurrentTab().then((tab) => {
    if (tab.url && tab.url.includes("tinchi.neu.edu.vn")) {
      loadStoredData();
      initUI();
    }

    fetch("https://tinchi.neu.edu.vn/DangKyHocPhan/KetQuaDangKy/1").then(
      (response) => {
        response
          .text()
          .then(
            (_) => (document.getElementById("registeredSubjects").innerHTML = _)
          );
      }
    );
  });
}

var intervalID = 0;
function doWork() {
  clearInterval(intervalID);

  intervalID = setInterval(() => {
    storedData
      .map((data) => data[0])
      .forEach((data) => {
        var request =
          "https://tinchi.neu.edu.vn/DangKyHocPhan/DangKy?Hide=" +
          data +
          "$0.0$" +
          data.split("_")[0] +
          "$$0&acceptConflict=true&classStudyUnitConflictId=&RegistType=KH";
        console.log(request);

        timeoutFetch(
          3000,
          fetch(request)
            .then((response) => response.text())
            .then((jsonText) => {
              console.log(jsonText);

              if (storedData.filter((v) => v[0] == data).length <= 0) return;

              var json = JSON.parse(jsonText);
              var message = json.Msg.toLowerCase();
              console.log(message);
              if (message.includes("đã đủ số lượng")) {
                document.getElementById(data + "_status").innerHTML =
                  "Hết slot. Đang chờ để nhảy vào ...";
                document.getElementById(data + "_status").style.color = "gray";
              } else if (message.includes("trùng lịch")) {
                document.getElementById(data + "_status").innerHTML =
                  "Trùng lịch";
                document.getElementById(data + "_status").style.color =
                  "goldenrod";
                removeStoreData(data);
              } else if (message.includes("vượt quá")) {
                document.getElementById(data + "_status").innerHTML =
                  "Đã đủ số tín";
                document.getElementById(data + "_status").style.color =
                  "darkblue";
                removeStoreData(data);
              } else if (message.includes("thành công")) {
                document.getElementById(data + "_status").innerHTML =
                  "Thành công";
                document.getElementById(data + "_status").style.color = "green";
                removeStoreData(data);
              } else {
                document.getElementById(data + "_status").innerHTML =
                  "Không thể đăng ký";
                document.getElementById(data + "_status").style.color = "red";
                removeStoreData(data);
              }
            })
        );
      });
  }, 1000);
}

function timeoutFetch(ms, promise) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      reject(new Error("TIMEOUT"));
    }, ms);

    promise
      .then((value) => {
        clearTimeout(timer);
        resolve(value);
      })
      .catch((reason) => {
        clearTimeout(timer);
        reject(reason);
      });
  });
}

async function checkScheduleStatus(timeToCheck) {
  var args = timeToCheck.split(",");
  return await fetch("https://tinchi.neu.edu.vn/DangKyHocPhan/KetQuaDangKy/1")
    .then((response) => response.text())
    .then((res) => {
      var tempDiv = document.createElement("div");
      tempDiv.innerHTML = res;

      var query = tempDiv.querySelectorAll("tbody > tr");
      for (var i = 0; i < query.length; i++) {
        var element = query[i];
        var elementQuery = element.querySelectorAll("td");

        var data = [];
        for (var j = 0; j < elementQuery.length; j++) {
          data.push(elementQuery[j].innerText);
        }

        var schedule = element.querySelectorAll(".td-schedule")[0].innerText;

        if (
          schedule.includes(args[0].trim()) &&
          schedule.includes(args[1].trim())
        ) {
          return "Trùng lịch: " + data[2];
        }
      }

      return "OK";
    });
}
