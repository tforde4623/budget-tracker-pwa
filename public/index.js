let transactions = [];
let myChart;
let db;
let dbReq = indexedDB.open("budget-db", 1);

dbReq.onupgradeneeded = event => {
  db = event.target.result;

  // create object store
  let trans = db.createObjectStore('budget-db', { autoIncrement: true });
};

dbReq.onsuccess = event => {
  db = event.target.result;
};

dbReq.onerror = event => {
  alert("Problem opening local indexedDB", event.target.errorCode);
};

// when load check if online if so push indexed transactions to db
window.addEventListener("load", () => {
  if (navigator.onLine) {
    let trans = db.transaction(["budget-db"], "readwrite");
    let store = trans.objectStore("budget-db");
    let req = store.getAll();

    req.onsuccess = event => {
      fetch("/api/transaction", {
        method: "POST",
        body: JSON.stringify(event.target.result),
        headers: {
          Accept: "application/json, text/plain, */*",
          "Content-Type": "application/json"
        }
      }).then(store.clear())
        .then(() => {
          fetch("/api/transaction")
            .then(response => {
              return response.json();
            })
            .then(data => {
              // save db data on global variable
              transactions = data;

              populateTotal();
              populateTable();
              populateChart();
          });
        })
    };
  };
});  

function populateTotal() {
  // reduce transaction amounts to a single total value
  let total = transactions.reduce((total, t) => {
    return total + parseInt(t.value);
  }, 0);

  let totalEl = document.querySelector("#total");
  totalEl.textContent = total;
}

function populateTable() {
  let tbody = document.querySelector("#tbody");
  tbody.innerHTML = "";

  transactions.forEach(transaction => {
    // create and populate a table row
    let tr = document.createElement("tr");
    tr.innerHTML = `
      <td>${transaction.name}</td>
      <td>${transaction.value}</td>
    `;

    tbody.appendChild(tr);
  });
}

function populateChart() {
  // copy array and reverse it
  let reversed = transactions.slice().reverse();
  let sum = 0;

  // create date labels for chart
  let labels = reversed.map(t => {
    let date = new Date(t.date);
    return `${date.getMonth() + 1}/${date.getDate()}/${date.getFullYear()}`;
  });

  // create incremental values for chart
  let data = reversed.map(t => {
    sum += parseInt(t.value);
    return sum;
  });

  // remove old chart if it exists
  if (myChart) {
    myChart.destroy();
  }

  let ctx = document.getElementById("myChart").getContext("2d");

  myChart = new Chart(ctx, {
    type: 'line',
      data: {
        labels,
        datasets: [{
            label: "Total Over Time",
            fill: true,
            backgroundColor: "#6666ff",
            data
        }]
    }
  });
}

function sendTransaction(isAdding) {
  let nameEl = document.querySelector("#t-name");
  let amountEl = document.querySelector("#t-amount");
  let errorEl = document.querySelector(".form .error");

  // validate form
  if (nameEl.value === "" || amountEl.value === "") {
    errorEl.textContent = "Missing Information";
    return;
  }
  else {
    errorEl.textContent = "";
  }

  // create record
  let transaction = {
    name: nameEl.value,
    value: amountEl.value,
    date: new Date().toISOString()
  };

  // if subtracting funds, convert amount to negative number
  if (!isAdding) {
    transaction.value *= -1;
  }

  // add to beginning of current array of data
  transactions.unshift(transaction);

  // re-run logic to populate ui with new record
  populateChart();
  populateTable();
  populateTotal();
  
  // also send to server
  fetch("/api/transaction", {
    method: "POST",
    body: JSON.stringify(transaction),
    headers: {
      Accept: "application/json, text/plain, */*",
      "Content-Type": "application/json"
    }
  })
  .then(response => {    
    return response.json();
  })
  .then(data => {
    if (data.errors) {
      errorEl.textContent = "Missing Information";
    }
    else {
      // clear form
      nameEl.value = "";
      amountEl.value = "";
    }
  })
  .catch(err => {
    // fetch failed, so save in indexed db
    addRecord(db, transaction);

    // clear form
    nameEl.value = "";
    amountEl.value = "";
  });
}

function addRecord(db, data) {
  // start a indDB transaction
  let trans = db.transaction(["budget-db"], "readwrite");
  let store = trans.objectStore('budget-db');
  
  // put new transaction (as in adding or sub money, not the objstore transaction)
  let newData = { name: data.name ,value: data.value, date: data.date };
  store.add(newData);

  // success/ failure
  trans.oncomplete = msg => console.log("Successfully stored in local db", msg);
  trans.onerror = err => console.log("Error storing transaction in local db", err);
};

document.querySelector("#add-btn").onclick = function() {
  sendTransaction(true);
};

document.querySelector("#sub-btn").onclick = function() {
  sendTransaction(false);
};

// have a function to try to make a req to save record when trans made