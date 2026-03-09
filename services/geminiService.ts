import { GoogleGenAI } from "@google/genai";

/**
 * Hàm làm sạch Schema JSON trước khi gửi lên Gemini.
 * Gemini API sử dụng một tập con của OpenAPI 3.0.
 * LƯU Ý QUAN TRỌNG: 
 * 1. Không hỗ trợ từ khóa 'const'.
 * 2. Từ khóa 'enum' CHỈ được phép sử dụng cho kiểu STRING. 
 *    Sử dụng enum cho NUMBER hoặc INTEGER sẽ gây lỗi 400 INVALID_ARGUMENT.
 */
const sanitizeSchema = (schema: any): any => {
  if (typeof schema !== 'object' || schema === null) return schema;

  const newSchema = Array.isArray(schema) ? [...schema] : { ...schema };

  // Danh sách các từ khóa không được hỗ trợ bởi Gemini Schema
  const unsupportedKeys = [
    'const', 
    'minItems', 'maxItems', 
    'minLength', 'maxLength', 
    'pattern', 
    'additionalProperties',
    'title',
    'default',
    '$schema',
    'format',
    'oneOf', 'anyOf', 'allOf', 'not',
    'nullable',
    'definitions', '$ref' // Gemini không hỗ trợ ref
  ];

  // Xử lý const: Gemini không hỗ trợ const
  if (Object.prototype.hasOwnProperty.call(newSchema, 'const')) {
    const constVal = newSchema.const;
    // Chỉ chuyển sang enum nếu là chuỗi, vì Gemini chỉ cho phép enum với STRING
    if ((newSchema.type === 'string' || newSchema.type === 'STRING') || typeof constVal === 'string') {
      newSchema.enum = [constVal];
    } else if (typeof constVal === 'number') {
      // Với số, thêm vào description để hướng dẫn model
      newSchema.description = (newSchema.description ? newSchema.description + ". " : "") + `Value MUST be exactly ${constVal}.`;
    }
    // const sẽ được xóa trong vòng lặp bên dưới
  }

  // Xóa các key không hỗ trợ
  unsupportedKeys.forEach(key => {
    if (Object.prototype.hasOwnProperty.call(newSchema, key)) {
      delete newSchema[key];
    }
  });

  // Chuẩn hóa type về chữ hoa (Gemini yêu cầu STRING, NUMBER, INTEGER, BOOLEAN, ARRAY, OBJECT)
  if (newSchema.type && typeof newSchema.type === 'string') {
    newSchema.type = newSchema.type.toUpperCase();
  }

  // Xử lý enum: Nếu type không phải STRING, Gemini không cho phép enum
  if (Object.prototype.hasOwnProperty.call(newSchema, 'enum')) {
    const isString = newSchema.type === 'STRING';
    const allEnumStrings = Array.isArray(newSchema.enum) && newSchema.enum.every((e: any) => typeof e === 'string');
    
    if (!isString || !allEnumStrings) {
      delete newSchema.enum;
    }
  }

  // Đệ quy cho các thuộc tính con
  for (const key in newSchema) {
    if (typeof newSchema[key] === 'object' && newSchema[key] !== null) {
      newSchema[key] = sanitizeSchema(newSchema[key]);
    }
  }
  return newSchema;
};

export const analyzeImage = async (
  base64Image: string | string[],
  prompt: string,
  schemaJson: string,
  modelName: string,
  apiKeyOverride?: string,
  processingProfileId?: string,
  processingProfiles?: any[]
): Promise<any> => {
  const activeKey = apiKeyOverride || process.env.API_KEY;
  
  if (!activeKey) {
    throw new Error("Chưa cấu hình API Key. Vui lòng kiểm tra cài đặt.");
  }

  const ai = new GoogleGenAI({ apiKey: activeKey });

  let schema;
  try {
    const rawSchema = typeof schemaJson === 'string' ? JSON.parse(schemaJson) : schemaJson;
    schema = sanitizeSchema(rawSchema);
  } catch (e) {
    throw new Error("Cấu trúc Schema JSON không hợp lệ.");
  }

  const base64Images = Array.isArray(base64Image) ? base64Image : [base64Image];
  const imageParts = base64Images.map(base64 => ({
    inlineData: {
      mimeType: "image/jpeg",
      data: base64.replace(/\s/g, ''),
    },
  }));

  // Xử lý Reference Image nếu có
  let referenceImagePart = null;
  let referenceImageUrl: string | undefined;

  if (processingProfileId && processingProfiles) {
    const profile = processingProfiles.find(p => p.id === processingProfileId);
    if (profile && profile.enableReferenceImage && profile.referenceImageUrl) {
        referenceImageUrl = profile.referenceImageUrl;
    }
  }

  if (referenceImageUrl) {
    try {
      // Xử lý link Google Drive để lấy direct link
      let directUrl = referenceImageUrl;
      if (referenceImageUrl.includes('drive.google.com')) {
        let fileId = '';
        const fileIdMatch = referenceImageUrl.match(/\/file\/d\/([a-zA-Z0-9_-]+)/);
        if (fileIdMatch && fileIdMatch[1]) {
          fileId = fileIdMatch[1];
        } else {
          const idParamMatch = referenceImageUrl.match(/[?&]id=([a-zA-Z0-9_-]+)/);
          if (idParamMatch && idParamMatch[1]) {
            fileId = idParamMatch[1];
          }
        }
        if (fileId) {
          // Sử dụng endpoint export=download để lấy nội dung ảnh gốc
          directUrl = `https://drive.google.com/uc?export=download&id=${fileId}`;
        }
      }

      const response = await fetch(directUrl);
      if (!response.ok) throw new Error(`Không thể tải hình mẫu từ URL: ${response.status} ${response.statusText}`);
      
      let contentType = response.headers.get("content-type") || "image/jpeg";
      // Nếu content-type trả về là text/html (do trang login Google hoặc lỗi), cố gắng đoán mime type hoặc bỏ qua
      if (contentType.includes('text/html')) {
          console.warn("URL hình mẫu trả về trang HTML thay vì ảnh. Có thể do quyền truy cập.");
          throw new Error("URL hình mẫu không trả về file ảnh (nhận được text/html). Vui lòng kiểm tra quyền truy cập công khai.");
      }

      const arrayBuffer = await response.arrayBuffer();
      
      if (arrayBuffer.byteLength === 0) throw new Error("Hình mẫu có kích thước 0 byte.");

      // Browser-compatible ArrayBuffer to Base64 conversion
      let binary = '';
      const bytes = new Uint8Array(arrayBuffer);
      const len = bytes.byteLength;
      for (let i = 0; i < len; i++) {
        binary += String.fromCharCode(bytes[i]);
      }
      const base64Ref = window.btoa(binary);

      if (!base64Ref) throw new Error("Lỗi chuyển đổi base64 cho hình mẫu.");

      referenceImagePart = {
        inlineData: {
          mimeType: contentType,
          data: base64Ref,
        }
      };
    } catch (error) {
      console.warn("Lỗi tải hình mẫu:", error);
      // Không throw lỗi để tiếp tục xử lý hình chính, chỉ log warning
    }
  }

  const contentsParts = [];
  
  // Nếu có hình mẫu, đưa lên đầu tiên và cập nhật prompt
  let finalPrompt = prompt;
  if (referenceImagePart) {
    contentsParts.push(referenceImagePart);
    finalPrompt = `[HÌNH ẢNH THAM KHẢO]: Hình ảnh đầu tiên là hình mẫu có chú thích/khoanh vùng các vị trí cần đọc. Hãy hiểu cấu trúc và vị trí thông tin từ hình mẫu này.\n` +
                  `[HÌNH ẢNH CẦN XỬ LÝ]: Các hình ảnh tiếp theo là hình thực tế cần trích xuất dữ liệu. Hãy tìm các thông tin tương ứng ở vị trí tương tự như hình mẫu.\n` +
                  `[YÊU CẦU]: ${prompt}`;
  }

  contentsParts.push(...imageParts);

  contentsParts.push({ text: "Extract parameters precisely based on the provided image(s) and system instructions. Follow the response schema strictly." });

  try {
    const response = await ai.models.generateContent({
      model: modelName,
      contents: [
        {
          parts: contentsParts,
        }
      ],
      config: {
        systemInstruction: finalPrompt,
        responseMimeType: "application/json",
        responseSchema: schema,
        temperature: 0.1,
      },
    });

    const text = response.text;
    if (!text) throw new Error("AI không phản hồi dữ liệu hoặc hình ảnh không rõ ràng.");

    return JSON.parse(text);
  } catch (error: any) {
    console.error(`Gemini API Error:`, error);
    if (error.message?.toLowerCase().includes("invalid argument")) {
      throw new Error("Lỗi cấu hình (400): Schema chứa thuộc tính không hợp lệ (ví dụ: enum cho kiểu số). Vui lòng kiểm tra lại JSON Schema.");
    }
    throw error;
  }
};