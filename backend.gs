/** 
 * CAPTURE AI LAMINATOR - BACKEND SCRIPT V9.1
 * - Log Sheet: Added User, ProductionOrder, Product, Structure (Input). 
 * - Log Sheet: Renamed standard columns to Product_Std, Structure_Std.
 * - Sheet 'Product_Structure' stores distinct Products and Structures for dropdowns.
 * - UPDATE: Edit Standard by ID & Retroactive Log Update
 */

function doGet(e) {
  if (!e || !e.parameter) return ContentService.createTextOutput("Service Active").setMimeType(ContentService.MimeType.TEXT);
  const action = e.parameter.action;
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  
  if (action === "sync") {
    const machines = getMachines(ss);
    let allPresets = [];
    let allLogs = [];
    
    machines.forEach(m => {
      allPresets = allPresets.concat(getPresetsForMachine(ss, m));
      allLogs = allLogs.concat(getLogsForMachine(ss, m));
    });

    const labels = getLabels(ss);
    const appConfig = getAppConfig(ss);
    const scanConfigs = getScanConfigs(ss);
    const productStructures = getProductStructures(ss);

    return ContentService.createTextOutput(JSON.stringify({
      presets: allPresets,
      logs: allLogs,
      machines: machines,
      labels: labels,
      appConfig: appConfig,
      scanConfigs: scanConfigs,
      productStructures: productStructures
    })).setMimeType(ContentService.MimeType.JSON);
  } else if (action === "verify_user") {
    const u = e.parameter.u;
    const p = e.parameter.p;
    const result = verifyUser(ss, u, p);
    return ContentService.createTextOutput(JSON.stringify(result)).setMimeType(ContentService.MimeType.JSON);
  }
}

function doPost(e) {
  const data = JSON.parse(e.postData.contents);
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  
  if (data.action === "save_standard") {
    saveStandard(ss, data);
  } else if (data.action === "save_log") {
    saveLog(ss, data);
  } else if (data.action === "save_machines") {
    saveMachines(ss, data.machines);
  } else if (data.action === "save_labels") {
    saveLabels(ss, data.labels);
  } else if (data.action === "save_app_config") {
    saveAppConfig(ss, data.config);
  } else if (data.action === "save_scan_configs") {
    saveScanConfigs(ss, data.configs);
  }
  
  return ContentService.createTextOutput("Success").setMimeType(ContentService.MimeType.TEXT);
}

// --- PRODUCT & STRUCTURE MANAGEMENT ---
function getProductStructures(ss) {
  const sheet = getOrCreateSheet(ss, "Product_Structure");
  const data = sheet.getDataRange().getValues();
  // Row 1 is Header: Product | Structure
  let products = new Set();
  let structures = new Set();
  
  if (data.length > 1) {
    for(let i = 1; i < data.length; i++) {
      if(data[i][0]) products.add(data[i][0]);
      if(data[i][1]) structures.add(data[i][1]);
    }
  }
  
  return {
    products: Array.from(products).sort(),
    structures: Array.from(structures).sort()
  };
}

function saveProductStructureIfNew(ss, product, structure) {
  const sheet = getOrCreateSheet(ss, "Product_Structure");
  if (sheet.getLastRow() === 0) {
    sheet.appendRow(["Product", "Structure"]);
    sheet.getRange(1, 1, 1, 2).setFontWeight("bold");
  }
  
  const data = sheet.getDataRange().getValues();
  let productExists = false;
  let structureExists = false;
  
  for(let i = 1; i < data.length; i++) {
    if (String(data[i][0]) === String(product)) productExists = true;
    if (String(data[i][1]) === String(structure)) structureExists = true;
  }
  
  if (product || structure) {
     if (!productExists || !structureExists) {
        // Chỉ thêm nếu có ít nhất 1 cái mới, nhưng để đơn giản ta cứ append
        // (Logic tối ưu hơn: tìm cột trống để điền, nhưng append row an toàn hơn)
        sheet.appendRow([product || "", structure || ""]);
     }
  }
}

// --- LOGIC SCAN CONFIGS ---

function getScanConfigs(ss) {
  const sheet = getOrCreateSheet(ss, "ScanConfigs");
  const data = sheet.getDataRange().getValues();
  
  if (data.length < 2) {
    const defaultPrompt = "Hãy đóng vai trò là một hệ thống OCR chuyên nghiệp. Nhiệm vụ của bạn là trích xuất các thông số kỹ thuật từ hình ảnh phiếu tráng khô và trả về định dạng JSON.\n\nQUY TẮC TRÍCH XUẤT VÀ GHÉP CHUỖI ĐỘNG:\n1. Xác định Khổ Màng Ưu Tiên (Dải khổ màng):\n- Bước 1: Kiểm tra bảng '5. Lực căng (kg)'. Nếu bảng này có cột 'Khổ màng', hãy lấy giá trị ở dòng đầu tiên (ví dụ: '600 - 890').\n- Bước 2: Nếu bảng '5. Lực căng (kg)' không có cột 'Khổ màng', hãy lấy giá trị tại mục 'Khổ màng (mm)' ở phần Header.\n2. Tên Sản Phẩm: Ghép [Tên sản phẩm] + ([Dải khổ màng]) + - + [Số hiệu văn bản].\n3. Cấu Trúc: Lấy tại mục 2. Cấu trúc.\n4. Xử lý bảng Lực căng: Lấy dòng đầu tiên. Làm sạch số (bỏ ≤, ≥, /...).\n5. Gán Giá trị (std) và Dung sai (tol): Lực căng (tol=2), Nhiệt & Tốc độ (tol=5).";
    
    const defaultSchema = JSON.stringify({
      "type": "object",
      "properties": {
        "Ten_San_Pham": { "type": "string" },
        "Cau_Truc": { "type": "string" },
        "unwind2": { "type": "object", "properties": { "std": { "type": "number" }, "tol": { "type": "number", "description": "Mặc định 2" } } },
        "rewind": { "type": "object", "properties": { "std": { "type": "number" }, "tol": { "type": "number", "description": "Mặc định 2" } } },
        "unwind1": { "type": "object", "properties": { "std": { "type": "number" }, "tol": { "type": "number", "description": "Mặc định 2" } } },
        "infeed": { "type": "object", "properties": { "std": { "type": "number" }, "tol": { "type": "number", "description": "Mặc định 2" } } },
        "oven": { "type": "object", "properties": { "std": { "type": "number" }, "tol": { "type": "number", "description": "Mặc định 2" } } },
        "speed": { "type": "object", "properties": { "std": { "type": "number" }, "tol": { "type": "number", "description": "Mặc định 5" } } },
        "dryer1": { "type": "object", "properties": { "std": { "type": "number" }, "tol": { "type": "number", "description": "Mặc định 5" } } },
        "dryer2": { "type": "object", "properties": { "std": { "type": "number" }, "tol": { "type": "number", "description": "Mặc định 5" } } },
        "dryer3": { "type": "object", "properties": { "std": { "type": "number" }, "tol": { "type": "number", "description": "Mặc định 5" } } },
        "chillerTemp": { "type": "object", "properties": { "std": { "type": "number" }, "tol": { "type": "number", "description": "Mặc định 5" } } },
        "axisTemp": { "type": "object", "properties": { "std": { "type": "number" }, "tol": { "type": "number", "description": "Mặc định 5" } } }
      }
    });

    sheet.clear().appendRow(["MachineID", "Prompt", "SchemaJSON"]);
    sheet.appendRow(["m_T06", defaultPrompt, defaultSchema]);
    return [{ machineId: "m_T06", prompt: defaultPrompt, schema: defaultSchema }];
  }

  return data.slice(1).map(row => ({
    machineId: row[0],
    prompt: row[1],
    schema: row[2]
  }));
}

function saveScanConfigs(ss, configs) {
  const sheet = getOrCreateSheet(ss, "ScanConfigs");
  sheet.clear().appendRow(["MachineID", "Prompt", "SchemaJSON"]);
  configs.forEach(c => {
    sheet.appendRow([c.machineId, c.prompt, c.schema]);
  });
  sheet.getRange(1, 1, 1, 3).setFontWeight("bold").setBackground("#e0f2fe");
}

function getAppConfig(ss) {
  const sheet = getOrCreateSheet(ss, "AppConfig");
  const data = sheet.getDataRange().getValues();
  if (data.length < 2) return { apiKeys: [], scriptUrls: [], models: [] };
  try {
    return JSON.parse(data[1][0]);
  } catch (e) {
    return { apiKeys: [], scriptUrls: [], models: [] };
  }
}

function saveAppConfig(ss, config) {
  const sheet = getOrCreateSheet(ss, "AppConfig");
  sheet.clear().appendRow(["ConfigJSON"]);
  sheet.appendRow([JSON.stringify(config)]);
  sheet.getRange(1, 1).setFontWeight("bold").setBackground("#dcfce7");
}

function getLabels(ss) {
  const sheet = getOrCreateSheet(ss, "Labels");
  const data = sheet.getDataRange().getValues();
  let labels = {};
  if (data.length < 2) return labels;
  for (let i = 1; i < data.length; i++) {
    if (data[i][0]) labels[data[i][0]] = data[i][1];
  }
  return labels;
}

function saveLabels(ss, labels) {
  const sheet = getOrCreateSheet(ss, "Labels");
  sheet.clear().appendRow(["Key", "DisplayName"]);
  Object.keys(labels).forEach(key => {
    sheet.appendRow([key, labels[key]]);
  });
}

function saveStandard(ss, payload) {
  const machine = getMachineById(ss, payload.machineId);
  if (!machine) return;
  const sheetName = machine.name + "_Standards";
  const sheet = getOrCreateSheet(ss, sheetName);
  const keys = Object.keys(payload.data);
  setupDynamicHeaders(sheet, ["ID", "ProductName", "Structure"], keys, ["std", "tol"]);
  
  const data = sheet.getDataRange().getValues();
  const headers = data[0];
  
  // Dynamic Column Indices
  const idIdx = headers.indexOf("ID");
  const nameIdx = headers.indexOf("ProductName");
  const structIdx = headers.indexOf("Structure");

  let rowIndex = -1;
  let oldProductName = "";
  let oldStructure = "";
  
  const payloadId = payload.id ? String(payload.id).trim() : "";

  // 1. Tìm bằng ID trước (ưu tiên khi Edit)
  if (payloadId && idIdx !== -1) {
    for (let i = 1; i < data.length; i++) {
      if (String(data[i][idIdx]).trim() === payloadId) {
        rowIndex = i + 1;
        oldProductName = nameIdx !== -1 ? data[i][nameIdx] : "";
        oldStructure = structIdx !== -1 ? data[i][structIdx] : "";
        break;
      }
    }
  }

  // 2. Nếu không tìm thấy ID, tìm bằng Tên + Cấu Trúc (legacy/fallback)
  if (rowIndex === -1 && nameIdx !== -1 && structIdx !== -1) {
    for (let i = 1; i < data.length; i++) {
      if (data[i][nameIdx] === payload.productName && data[i][structIdx] === payload.structure) {
        rowIndex = i + 1;
        oldProductName = data[i][nameIdx];
        oldStructure = data[i][structIdx];
        break;
      }
    }
  }

  // 3. Nếu vẫn không thấy => Tạo mới
  if (rowIndex === -1) {
    rowIndex = sheet.getLastRow() + 1;
    // Gán ID mới nếu chưa có
    if (!payload.id) payload.id = "std_" + new Date().getTime();
  }

  // Prepare row data
  let newRow = new Array(headers.length).fill("");
  
  // If updating, preserve existing data
  if (rowIndex <= sheet.getLastRow()) {
     const existingRow = sheet.getRange(rowIndex, 1, 1, headers.length).getValues()[0];
     newRow = [...existingRow];
  }

  // Update with new data
  if (idIdx !== -1) newRow[idIdx] = payload.id || payloadId;
  if (nameIdx !== -1) newRow[nameIdx] = payload.productName;
  if (structIdx !== -1) newRow[structIdx] = payload.structure;
  
  keys.forEach(key => {
    const stdIdx = headers.indexOf(key + "_std");
    const tolIdx = headers.indexOf(key + "_tol");
    if (stdIdx > -1) newRow[stdIdx] = payload.data[key];
    if (tolIdx > -1) newRow[tolIdx] = payload.tolerances[key];
  });
  
  sheet.getRange(rowIndex, 1, 1, newRow.length).setValues([newRow]);
  
  // 4. Cập nhật các bản ghi nhật ký (Logs) nếu Tên hoặc Cấu trúc thay đổi
  if (oldProductName && (oldProductName !== payload.productName || oldStructure !== payload.structure)) {
      updateLogsForRenamedProduct(ss, machine.name + "_Logs", oldProductName, oldStructure, payload.productName, payload.structure);
  }
}

function updateLogsForRenamedProduct(ss, logSheetName, oldName, oldStructure, newName, newStructure) {
  const sheet = ss.getSheetByName(logSheetName);
  if (!sheet || sheet.getLastRow() < 2) return;
  
  const dataRange = sheet.getDataRange();
  const data = dataRange.getValues();
  const headers = data[0];
  
  // Mapping columns (New Header names based on latest saveLog logic)
  // New: "Product", "Structure", "Product_Std", "Structure_Std"
  // Old logs might have "ProductName"
  const idxProd = headers.indexOf("Product") > -1 ? headers.indexOf("Product") : headers.indexOf("ProductName");
  const idxStruct = headers.indexOf("Structure");
  const idxProdStd = headers.indexOf("Product_Std");
  const idxStructStd = headers.indexOf("Structure_Std");
  
  let updated = false;
  
  for(let i = 1; i < data.length; i++) {
    let rowChanged = false;
    
    // Check Main Product/Structure (Input) - Optional: Update manual inputs too? 
    // Usually manual inputs reflect history, but user requested "các lần chụp đã sử dụng thông số chuẩn trước đó cũng đổi theo"
    // So we update Standard References AND Manual Inputs if they matched the old standard.
    
    // Update Standard Reference Columns
    if (idxProdStd > -1 && String(data[i][idxProdStd]) === String(oldName)) {
       data[i][idxProdStd] = newName;
       rowChanged = true;
    }
    if (idxStructStd > -1 && String(data[i][idxStructStd]) === String(oldStructure)) {
       data[i][idxStructStd] = newStructure;
       rowChanged = true;
    }
    
    // Update Manual Input Columns if they were identical to old standard
    if (idxProd > -1 && String(data[i][idxProd]) === String(oldName)) {
       data[i][idxProd] = newName;
       rowChanged = true;
    }
    if (idxStruct > -1 && String(data[i][idxStruct]) === String(oldStructure)) {
       data[i][idxStruct] = newStructure;
       rowChanged = true;
    }
    
    if (rowChanged) updated = true;
  }
  
  if (updated) {
    dataRange.setValues(data);
  }
}

function saveLog(ss, payload) {
  const machineName = payload.machineName;
  const sheetName = machineName + "_Logs";
  const sheet = getOrCreateSheet(ss, sheetName);
  
  // Updated System Keys
  const systemKeys = ["action", "timestamp", "product", "structure", "productStd", "structureStd", "productionOrder", "machineId", "machineName", "uploadedBy", "model"];
  const keys = Object.keys(payload).filter(k => !systemKeys.includes(k) && !k.startsWith("std_") && !k.startsWith("diff_"));
  
  // Updated Headers: 
  setupDynamicHeaders(sheet, ["Timestamp", "User", "ProductionOrder", "Product", "Structure", "Product_Std", "Structure_Std"], keys, ["act", "std", "diff"]);
  
  const headers = sheet.getDataRange().getValues()[0];
  const newRow = new Array(headers.length).fill("");
  
  newRow[headers.indexOf("Timestamp")] = payload.timestamp;
  newRow[headers.indexOf("User")] = payload.uploadedBy || "";
  newRow[headers.indexOf("ProductionOrder")] = payload.productionOrder || "";
  
  // Manual Inputs
  newRow[headers.indexOf("Product")] = payload.product || "";
  newRow[headers.indexOf("Structure")] = payload.structure || "";
  
  // Standard Refs
  newRow[headers.indexOf("Product_Std")] = payload.productStd || "";
  newRow[headers.indexOf("Structure_Std")] = payload.structureStd || "";

  keys.forEach(key => {
    const actIdx = headers.indexOf(key + "_act");
    const stdIdx = headers.indexOf(key + "_std");
    const diffIdx = headers.indexOf(key + "_diff");
    if (actIdx > -1) newRow[actIdx] = payload[key];
    if (stdIdx > -1) newRow[stdIdx] = payload["std_" + key];
    if (diffIdx > -1) newRow[diffIdx] = payload["diff_" + key];
  });
  sheet.appendRow(newRow);
  
  // Save to Product_Structure list for future dropdowns
  saveProductStructureIfNew(ss, payload.product, payload.structure);
}

function setupDynamicHeaders(sheet, baseHeaders, keys, suffixes) {
  if (sheet.getLastRow() === 0) {
    const headers = [...baseHeaders];
    keys.forEach(k => suffixes.forEach(s => headers.push(k + "_" + s)));
    sheet.appendRow(headers);
  } else {
    let existingHeaders = sheet.getDataRange().getValues()[0];
    let added = false;
    keys.forEach(k => {
      suffixes.forEach(s => {
        const hName = k + "_" + s;
        if (existingHeaders.indexOf(hName) === -1) {
          existingHeaders.push(hName);
          added = true;
        }
      });
    });
    if (added) sheet.getRange(1, 1, 1, existingHeaders.length).setValues([existingHeaders]);
  }
}

function getMachines(ss) {
  const sheet = getOrCreateSheet(ss, "Machines");
  const data = sheet.getDataRange().getValues();
  if (data.length < 2) return [];
  return data.slice(1).map(row => JSON.parse(row[0]));
}

function saveMachines(ss, machines) {
  const sheet = getOrCreateSheet(ss, "Machines");
  sheet.clear().appendRow(["MachineConfigJSON"]);
  machines.forEach(m => sheet.appendRow([JSON.stringify(m)]));
}

function getPresetsForMachine(ss, machine) {
  const sheetName = machine.name + "_Standards";
  const sheet = ss.getSheetByName(sheetName);
  if (!sheet) return [];
  const data = sheet.getDataRange().getValues();
  if (data.length < 2) return [];
  const headers = data[0];
  const keys = headers.filter(h => h.endsWith("_std")).map(h => h.replace("_std", ""));
  return data.slice(1).map(row => {
    let obj = { id: row[0], productName: row[1], structure: row[2], machineId: machine.id, data: {}, tolerances: {} };
    keys.forEach(key => {
      obj.data[key] = row[headers.indexOf(key + "_std")];
      obj.tolerances[key] = row[headers.indexOf(key + "_tol")];
    });
    return obj;
  });
}

function getLogsForMachine(ss, machine) {
  const sheet = ss.getSheetByName(machine.name + "_Logs");
  if (!sheet) return [];
  const data = sheet.getDataRange().getValues();
  if (data.length < 2) return [];
  const headers = data[0];
  return data.slice(1).map(row => {
    let obj = { machineId: machine.id };
    headers.forEach((h, i) => obj[h] = row[i]);
    return obj;
  });
}

function getOrCreateSheet(ss, name) {
  let sheet = ss.getSheetByName(name);
  if (!sheet) sheet = ss.insertSheet(name);
  return sheet;
}

function getMachineById(ss, id) {
  const machines = getMachines(ss);
  return machines.find(m => m.id === id);
}

// --- USER MANAGEMENT LOGIC ---

function verifyUser(ss, username, password) {
  const sheet = getOrCreateSheet(ss, "Users");
  const data = sheet.getDataRange().getValues();
  if (data.length < 2) return { success: false, message: "Chưa có người dùng nào." };
  for (let i = 1; i < data.length; i++) {
    if (String(data[i][0]).toLowerCase() === String(username).toLowerCase()) {
      if (String(data[i][2]) === String(password)) {
        return { 
          success: true, 
          user: { 
            username: data[i][0], 
            email: data[i][1], 
            role: data[i][3] || 'user' 
          } 
        };
      } else {
        return { success: false, message: "Sai mật khẩu." };
      }
    }
  }
  return { success: false, message: "Tên đăng nhập không tồn tại." };
}

function registerUser(ss, username, password, email) {
  const sheet = getOrCreateSheet(ss, "Users");
  if (sheet.getLastRow() === 0) {
    sheet.appendRow(["Username", "Email", "Password", "Role"]);
    sheet.getRange(1, 1, 1, 4).setFontWeight("bold");
  }
  const data = sheet.getDataRange().getValues();
  for (let i = 1; i < data.length; i++) {
    if (String(data[i][0]).toLowerCase() === String(username).toLowerCase()) {
      return; 
    }
  }
  sheet.appendRow([username, email, password, "user"]);
}