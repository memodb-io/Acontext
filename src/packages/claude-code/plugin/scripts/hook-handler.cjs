#!/usr/bin/env node
"use strict";
var __create = Object.create;
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __getProtoOf = Object.getPrototypeOf;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __name = (target, value) => __defProp(target, "name", { value, configurable: true });
var __commonJS = (cb, mod) => function __require() {
  return mod || (0, cb[__getOwnPropNames(cb)[0]])((mod = { exports: {} }).exports, mod), mod.exports;
};
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toESM = (mod, isNodeMode, target) => (target = mod != null ? __create(__getProtoOf(mod)) : {}, __copyProps(
  // If the importer is in node compatibility mode or this is not an ESM
  // file that has been converted to a CommonJS file using a Babel-
  // compatible transform (i.e. "__esModule" has not been set), then set
  // "default" to the CommonJS "module.exports" for node compatibility.
  isNodeMode || !mod || !mod.__esModule ? __defProp(target, "default", { value: mod, enumerable: true }) : target,
  mod
));

// node_modules/@acontext/acontext/dist/errors.js
var require_errors = __commonJS({
  "node_modules/@acontext/acontext/dist/errors.js"(exports2) {
    "use strict";
    Object.defineProperty(exports2, "__esModule", { value: true });
    exports2.TimeoutError = exports2.TransportError = exports2.APIError = exports2.AcontextError = void 0;
    var AcontextError = class _AcontextError extends Error {
      static {
        __name(this, "AcontextError");
      }
      constructor(message) {
        super(message);
        this.name = "AcontextError";
        Object.setPrototypeOf(this, _AcontextError.prototype);
      }
    };
    exports2.AcontextError = AcontextError;
    var APIError = class _APIError extends AcontextError {
      static {
        __name(this, "APIError");
      }
      constructor(options) {
        const details = options.message || options.error || "API request failed";
        super(`${options.statusCode}: ${details}`);
        this.name = "APIError";
        this.statusCode = options.statusCode;
        this.code = options.code;
        this.message = details;
        this.error = options.error;
        this.payload = options.payload;
        Object.setPrototypeOf(this, _APIError.prototype);
      }
    };
    exports2.APIError = APIError;
    var TransportError = class _TransportError extends AcontextError {
      static {
        __name(this, "TransportError");
      }
      constructor(message) {
        super(message);
        this.name = "TransportError";
        Object.setPrototypeOf(this, _TransportError.prototype);
      }
    };
    exports2.TransportError = TransportError;
    var TimeoutError = class _TimeoutError extends AcontextError {
      static {
        __name(this, "TimeoutError");
      }
      constructor(message = "operation timed out") {
        super(message);
        this.name = "TimeoutError";
        Object.setPrototypeOf(this, _TimeoutError.prototype);
      }
    };
    exports2.TimeoutError = TimeoutError;
  }
});

// node_modules/@acontext/acontext/dist/uploads.js
var require_uploads = __commonJS({
  "node_modules/@acontext/acontext/dist/uploads.js"(exports2) {
    "use strict";
    Object.defineProperty(exports2, "__esModule", { value: true });
    exports2.FileUpload = void 0;
    exports2.normalizeFileUpload = normalizeFileUpload;
    var FileUpload = class {
      static {
        __name(this, "FileUpload");
      }
      constructor(options) {
        this.filename = options.filename;
        this.content = options.content;
        this.contentType = options.contentType ?? null;
      }
      /**
       * Convert to a format suitable for form-data.
       */
      asFormData() {
        return {
          filename: this.filename,
          content: this.content,
          contentType: this.contentType || "application/octet-stream"
        };
      }
    };
    exports2.FileUpload = FileUpload;
    function normalizeFileUpload(upload) {
      if (upload instanceof FileUpload) {
        return upload;
      }
      if (Array.isArray(upload)) {
        if (upload.length === 2) {
          const [filename, content] = upload;
          return new FileUpload({ filename, content });
        }
        if (upload.length === 3) {
          const [filename, content, contentType] = upload;
          return new FileUpload({
            filename,
            content,
            contentType: contentType ?? null
          });
        }
      }
      throw new TypeError("Unsupported file upload payload");
    }
    __name(normalizeFileUpload, "normalizeFileUpload");
  }
});

// node_modules/@acontext/acontext/dist/utils.js
var require_utils = __commonJS({
  "node_modules/@acontext/acontext/dist/utils.js"(exports2) {
    "use strict";
    Object.defineProperty(exports2, "__esModule", { value: true });
    exports2.boolToStr = boolToStr;
    exports2.buildParams = buildParams;
    exports2.isValidUUID = isValidUUID;
    exports2.validateUUID = validateUUID;
    function boolToStr(value) {
      return value ? "true" : "false";
    }
    __name(boolToStr, "boolToStr");
    function buildParams(params) {
      const result = {};
      for (const [key, value] of Object.entries(params)) {
        if (value !== null && value !== void 0) {
          if (typeof value === "boolean") {
            result[key] = boolToStr(value);
          } else {
            result[key] = value;
          }
        }
      }
      return result;
    }
    __name(buildParams, "buildParams");
    function isValidUUID(uuid) {
      const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
      return uuidRegex.test(uuid);
    }
    __name(isValidUUID, "isValidUUID");
    function validateUUID(uuid, paramName = "id") {
      if (!isValidUUID(uuid)) {
        throw new Error(`Invalid UUID format for ${paramName}: ${uuid}`);
      }
    }
    __name(validateUUID, "validateUUID");
  }
});

// node_modules/zod/v4/core/core.cjs
var require_core = __commonJS({
  "node_modules/zod/v4/core/core.cjs"(exports2) {
    "use strict";
    Object.defineProperty(exports2, "__esModule", { value: true });
    exports2.globalConfig = exports2.$ZodEncodeError = exports2.$ZodAsyncError = exports2.$brand = exports2.NEVER = void 0;
    exports2.$constructor = $constructor;
    exports2.config = config;
    exports2.NEVER = Object.freeze({
      status: "aborted"
    });
    function $constructor(name, initializer, params) {
      function init(inst, def) {
        if (!inst._zod) {
          Object.defineProperty(inst, "_zod", {
            value: {
              def,
              constr: _,
              traits: /* @__PURE__ */ new Set()
            },
            enumerable: false
          });
        }
        if (inst._zod.traits.has(name)) {
          return;
        }
        inst._zod.traits.add(name);
        initializer(inst, def);
        const proto = _.prototype;
        const keys = Object.keys(proto);
        for (let i = 0; i < keys.length; i++) {
          const k = keys[i];
          if (!(k in inst)) {
            inst[k] = proto[k].bind(inst);
          }
        }
      }
      __name(init, "init");
      const Parent = params?.Parent ?? Object;
      class Definition extends Parent {
        static {
          __name(this, "Definition");
        }
      }
      Object.defineProperty(Definition, "name", { value: name });
      function _(def) {
        var _a;
        const inst = params?.Parent ? new Definition() : this;
        init(inst, def);
        (_a = inst._zod).deferred ?? (_a.deferred = []);
        for (const fn of inst._zod.deferred) {
          fn();
        }
        return inst;
      }
      __name(_, "_");
      Object.defineProperty(_, "init", { value: init });
      Object.defineProperty(_, Symbol.hasInstance, {
        value: /* @__PURE__ */ __name((inst) => {
          if (params?.Parent && inst instanceof params.Parent)
            return true;
          return inst?._zod?.traits?.has(name);
        }, "value")
      });
      Object.defineProperty(_, "name", { value: name });
      return _;
    }
    __name($constructor, "$constructor");
    exports2.$brand = /* @__PURE__ */ Symbol("zod_brand");
    var $ZodAsyncError = class extends Error {
      static {
        __name(this, "$ZodAsyncError");
      }
      constructor() {
        super(`Encountered Promise during synchronous parse. Use .parseAsync() instead.`);
      }
    };
    exports2.$ZodAsyncError = $ZodAsyncError;
    var $ZodEncodeError = class extends Error {
      static {
        __name(this, "$ZodEncodeError");
      }
      constructor(name) {
        super(`Encountered unidirectional transform during encode: ${name}`);
        this.name = "ZodEncodeError";
      }
    };
    exports2.$ZodEncodeError = $ZodEncodeError;
    exports2.globalConfig = {};
    function config(newConfig) {
      if (newConfig)
        Object.assign(exports2.globalConfig, newConfig);
      return exports2.globalConfig;
    }
    __name(config, "config");
  }
});

// node_modules/zod/v4/core/util.cjs
var require_util = __commonJS({
  "node_modules/zod/v4/core/util.cjs"(exports2) {
    "use strict";
    Object.defineProperty(exports2, "__esModule", { value: true });
    exports2.Class = exports2.BIGINT_FORMAT_RANGES = exports2.NUMBER_FORMAT_RANGES = exports2.primitiveTypes = exports2.propertyKeyTypes = exports2.getParsedType = exports2.allowsEval = exports2.captureStackTrace = void 0;
    exports2.assertEqual = assertEqual;
    exports2.assertNotEqual = assertNotEqual;
    exports2.assertIs = assertIs;
    exports2.assertNever = assertNever;
    exports2.assert = assert;
    exports2.getEnumValues = getEnumValues;
    exports2.joinValues = joinValues;
    exports2.jsonStringifyReplacer = jsonStringifyReplacer;
    exports2.cached = cached;
    exports2.nullish = nullish;
    exports2.cleanRegex = cleanRegex;
    exports2.floatSafeRemainder = floatSafeRemainder;
    exports2.defineLazy = defineLazy;
    exports2.objectClone = objectClone;
    exports2.assignProp = assignProp;
    exports2.mergeDefs = mergeDefs;
    exports2.cloneDef = cloneDef;
    exports2.getElementAtPath = getElementAtPath;
    exports2.promiseAllObject = promiseAllObject;
    exports2.randomString = randomString;
    exports2.esc = esc;
    exports2.slugify = slugify;
    exports2.isObject = isObject;
    exports2.isPlainObject = isPlainObject;
    exports2.shallowClone = shallowClone;
    exports2.numKeys = numKeys;
    exports2.escapeRegex = escapeRegex;
    exports2.clone = clone;
    exports2.normalizeParams = normalizeParams;
    exports2.createTransparentProxy = createTransparentProxy;
    exports2.stringifyPrimitive = stringifyPrimitive;
    exports2.optionalKeys = optionalKeys;
    exports2.pick = pick;
    exports2.omit = omit;
    exports2.extend = extend;
    exports2.safeExtend = safeExtend;
    exports2.merge = merge;
    exports2.partial = partial;
    exports2.required = required;
    exports2.aborted = aborted;
    exports2.prefixIssues = prefixIssues;
    exports2.unwrapMessage = unwrapMessage;
    exports2.finalizeIssue = finalizeIssue;
    exports2.getSizableOrigin = getSizableOrigin;
    exports2.getLengthableOrigin = getLengthableOrigin;
    exports2.parsedType = parsedType;
    exports2.issue = issue;
    exports2.cleanEnum = cleanEnum;
    exports2.base64ToUint8Array = base64ToUint8Array;
    exports2.uint8ArrayToBase64 = uint8ArrayToBase64;
    exports2.base64urlToUint8Array = base64urlToUint8Array;
    exports2.uint8ArrayToBase64url = uint8ArrayToBase64url;
    exports2.hexToUint8Array = hexToUint8Array;
    exports2.uint8ArrayToHex = uint8ArrayToHex;
    function assertEqual(val) {
      return val;
    }
    __name(assertEqual, "assertEqual");
    function assertNotEqual(val) {
      return val;
    }
    __name(assertNotEqual, "assertNotEqual");
    function assertIs(_arg) {
    }
    __name(assertIs, "assertIs");
    function assertNever(_x) {
      throw new Error("Unexpected value in exhaustive check");
    }
    __name(assertNever, "assertNever");
    function assert(_) {
    }
    __name(assert, "assert");
    function getEnumValues(entries) {
      const numericValues = Object.values(entries).filter((v) => typeof v === "number");
      const values = Object.entries(entries).filter(([k, _]) => numericValues.indexOf(+k) === -1).map(([_, v]) => v);
      return values;
    }
    __name(getEnumValues, "getEnumValues");
    function joinValues(array, separator = "|") {
      return array.map((val) => stringifyPrimitive(val)).join(separator);
    }
    __name(joinValues, "joinValues");
    function jsonStringifyReplacer(_, value) {
      if (typeof value === "bigint")
        return value.toString();
      return value;
    }
    __name(jsonStringifyReplacer, "jsonStringifyReplacer");
    function cached(getter) {
      const set = false;
      return {
        get value() {
          if (!set) {
            const value = getter();
            Object.defineProperty(this, "value", { value });
            return value;
          }
          throw new Error("cached value already set");
        }
      };
    }
    __name(cached, "cached");
    function nullish(input) {
      return input === null || input === void 0;
    }
    __name(nullish, "nullish");
    function cleanRegex(source) {
      const start = source.startsWith("^") ? 1 : 0;
      const end = source.endsWith("$") ? source.length - 1 : source.length;
      return source.slice(start, end);
    }
    __name(cleanRegex, "cleanRegex");
    function floatSafeRemainder(val, step) {
      const valDecCount = (val.toString().split(".")[1] || "").length;
      const stepString = step.toString();
      let stepDecCount = (stepString.split(".")[1] || "").length;
      if (stepDecCount === 0 && /\d?e-\d?/.test(stepString)) {
        const match = stepString.match(/\d?e-(\d?)/);
        if (match?.[1]) {
          stepDecCount = Number.parseInt(match[1]);
        }
      }
      const decCount = valDecCount > stepDecCount ? valDecCount : stepDecCount;
      const valInt = Number.parseInt(val.toFixed(decCount).replace(".", ""));
      const stepInt = Number.parseInt(step.toFixed(decCount).replace(".", ""));
      return valInt % stepInt / 10 ** decCount;
    }
    __name(floatSafeRemainder, "floatSafeRemainder");
    var EVALUATING = /* @__PURE__ */ Symbol("evaluating");
    function defineLazy(object, key, getter) {
      let value = void 0;
      Object.defineProperty(object, key, {
        get() {
          if (value === EVALUATING) {
            return void 0;
          }
          if (value === void 0) {
            value = EVALUATING;
            value = getter();
          }
          return value;
        },
        set(v) {
          Object.defineProperty(object, key, {
            value: v
            // configurable: true,
          });
        },
        configurable: true
      });
    }
    __name(defineLazy, "defineLazy");
    function objectClone(obj) {
      return Object.create(Object.getPrototypeOf(obj), Object.getOwnPropertyDescriptors(obj));
    }
    __name(objectClone, "objectClone");
    function assignProp(target, prop, value) {
      Object.defineProperty(target, prop, {
        value,
        writable: true,
        enumerable: true,
        configurable: true
      });
    }
    __name(assignProp, "assignProp");
    function mergeDefs(...defs) {
      const mergedDescriptors = {};
      for (const def of defs) {
        const descriptors = Object.getOwnPropertyDescriptors(def);
        Object.assign(mergedDescriptors, descriptors);
      }
      return Object.defineProperties({}, mergedDescriptors);
    }
    __name(mergeDefs, "mergeDefs");
    function cloneDef(schema) {
      return mergeDefs(schema._zod.def);
    }
    __name(cloneDef, "cloneDef");
    function getElementAtPath(obj, path5) {
      if (!path5)
        return obj;
      return path5.reduce((acc, key) => acc?.[key], obj);
    }
    __name(getElementAtPath, "getElementAtPath");
    function promiseAllObject(promisesObj) {
      const keys = Object.keys(promisesObj);
      const promises = keys.map((key) => promisesObj[key]);
      return Promise.all(promises).then((results) => {
        const resolvedObj = {};
        for (let i = 0; i < keys.length; i++) {
          resolvedObj[keys[i]] = results[i];
        }
        return resolvedObj;
      });
    }
    __name(promiseAllObject, "promiseAllObject");
    function randomString(length = 10) {
      const chars = "abcdefghijklmnopqrstuvwxyz";
      let str = "";
      for (let i = 0; i < length; i++) {
        str += chars[Math.floor(Math.random() * chars.length)];
      }
      return str;
    }
    __name(randomString, "randomString");
    function esc(str) {
      return JSON.stringify(str);
    }
    __name(esc, "esc");
    function slugify(input) {
      return input.toLowerCase().trim().replace(/[^\w\s-]/g, "").replace(/[\s_-]+/g, "-").replace(/^-+|-+$/g, "");
    }
    __name(slugify, "slugify");
    exports2.captureStackTrace = "captureStackTrace" in Error ? Error.captureStackTrace : (..._args) => {
    };
    function isObject(data) {
      return typeof data === "object" && data !== null && !Array.isArray(data);
    }
    __name(isObject, "isObject");
    exports2.allowsEval = cached(() => {
      if (typeof navigator !== "undefined" && navigator?.userAgent?.includes("Cloudflare")) {
        return false;
      }
      try {
        const F = Function;
        new F("");
        return true;
      } catch (_) {
        return false;
      }
    });
    function isPlainObject(o) {
      if (isObject(o) === false)
        return false;
      const ctor = o.constructor;
      if (ctor === void 0)
        return true;
      if (typeof ctor !== "function")
        return true;
      const prot = ctor.prototype;
      if (isObject(prot) === false)
        return false;
      if (Object.prototype.hasOwnProperty.call(prot, "isPrototypeOf") === false) {
        return false;
      }
      return true;
    }
    __name(isPlainObject, "isPlainObject");
    function shallowClone(o) {
      if (isPlainObject(o))
        return { ...o };
      if (Array.isArray(o))
        return [...o];
      return o;
    }
    __name(shallowClone, "shallowClone");
    function numKeys(data) {
      let keyCount = 0;
      for (const key in data) {
        if (Object.prototype.hasOwnProperty.call(data, key)) {
          keyCount++;
        }
      }
      return keyCount;
    }
    __name(numKeys, "numKeys");
    var getParsedType = /* @__PURE__ */ __name((data) => {
      const t = typeof data;
      switch (t) {
        case "undefined":
          return "undefined";
        case "string":
          return "string";
        case "number":
          return Number.isNaN(data) ? "nan" : "number";
        case "boolean":
          return "boolean";
        case "function":
          return "function";
        case "bigint":
          return "bigint";
        case "symbol":
          return "symbol";
        case "object":
          if (Array.isArray(data)) {
            return "array";
          }
          if (data === null) {
            return "null";
          }
          if (data.then && typeof data.then === "function" && data.catch && typeof data.catch === "function") {
            return "promise";
          }
          if (typeof Map !== "undefined" && data instanceof Map) {
            return "map";
          }
          if (typeof Set !== "undefined" && data instanceof Set) {
            return "set";
          }
          if (typeof Date !== "undefined" && data instanceof Date) {
            return "date";
          }
          if (typeof File !== "undefined" && data instanceof File) {
            return "file";
          }
          return "object";
        default:
          throw new Error(`Unknown data type: ${t}`);
      }
    }, "getParsedType");
    exports2.getParsedType = getParsedType;
    exports2.propertyKeyTypes = /* @__PURE__ */ new Set(["string", "number", "symbol"]);
    exports2.primitiveTypes = /* @__PURE__ */ new Set(["string", "number", "bigint", "boolean", "symbol", "undefined"]);
    function escapeRegex(str) {
      return str.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    }
    __name(escapeRegex, "escapeRegex");
    function clone(inst, def, params) {
      const cl = new inst._zod.constr(def ?? inst._zod.def);
      if (!def || params?.parent)
        cl._zod.parent = inst;
      return cl;
    }
    __name(clone, "clone");
    function normalizeParams(_params) {
      const params = _params;
      if (!params)
        return {};
      if (typeof params === "string")
        return { error: /* @__PURE__ */ __name(() => params, "error") };
      if (params?.message !== void 0) {
        if (params?.error !== void 0)
          throw new Error("Cannot specify both `message` and `error` params");
        params.error = params.message;
      }
      delete params.message;
      if (typeof params.error === "string")
        return { ...params, error: /* @__PURE__ */ __name(() => params.error, "error") };
      return params;
    }
    __name(normalizeParams, "normalizeParams");
    function createTransparentProxy(getter) {
      let target;
      return new Proxy({}, {
        get(_, prop, receiver) {
          target ?? (target = getter());
          return Reflect.get(target, prop, receiver);
        },
        set(_, prop, value, receiver) {
          target ?? (target = getter());
          return Reflect.set(target, prop, value, receiver);
        },
        has(_, prop) {
          target ?? (target = getter());
          return Reflect.has(target, prop);
        },
        deleteProperty(_, prop) {
          target ?? (target = getter());
          return Reflect.deleteProperty(target, prop);
        },
        ownKeys(_) {
          target ?? (target = getter());
          return Reflect.ownKeys(target);
        },
        getOwnPropertyDescriptor(_, prop) {
          target ?? (target = getter());
          return Reflect.getOwnPropertyDescriptor(target, prop);
        },
        defineProperty(_, prop, descriptor) {
          target ?? (target = getter());
          return Reflect.defineProperty(target, prop, descriptor);
        }
      });
    }
    __name(createTransparentProxy, "createTransparentProxy");
    function stringifyPrimitive(value) {
      if (typeof value === "bigint")
        return value.toString() + "n";
      if (typeof value === "string")
        return `"${value}"`;
      return `${value}`;
    }
    __name(stringifyPrimitive, "stringifyPrimitive");
    function optionalKeys(shape) {
      return Object.keys(shape).filter((k) => {
        return shape[k]._zod.optin === "optional" && shape[k]._zod.optout === "optional";
      });
    }
    __name(optionalKeys, "optionalKeys");
    exports2.NUMBER_FORMAT_RANGES = {
      safeint: [Number.MIN_SAFE_INTEGER, Number.MAX_SAFE_INTEGER],
      int32: [-2147483648, 2147483647],
      uint32: [0, 4294967295],
      float32: [-34028234663852886e22, 34028234663852886e22],
      float64: [-Number.MAX_VALUE, Number.MAX_VALUE]
    };
    exports2.BIGINT_FORMAT_RANGES = {
      int64: [/* @__PURE__ */ BigInt("-9223372036854775808"), /* @__PURE__ */ BigInt("9223372036854775807")],
      uint64: [/* @__PURE__ */ BigInt(0), /* @__PURE__ */ BigInt("18446744073709551615")]
    };
    function pick(schema, mask) {
      const currDef = schema._zod.def;
      const checks = currDef.checks;
      const hasChecks = checks && checks.length > 0;
      if (hasChecks) {
        throw new Error(".pick() cannot be used on object schemas containing refinements");
      }
      const def = mergeDefs(schema._zod.def, {
        get shape() {
          const newShape = {};
          for (const key in mask) {
            if (!(key in currDef.shape)) {
              throw new Error(`Unrecognized key: "${key}"`);
            }
            if (!mask[key])
              continue;
            newShape[key] = currDef.shape[key];
          }
          assignProp(this, "shape", newShape);
          return newShape;
        },
        checks: []
      });
      return clone(schema, def);
    }
    __name(pick, "pick");
    function omit(schema, mask) {
      const currDef = schema._zod.def;
      const checks = currDef.checks;
      const hasChecks = checks && checks.length > 0;
      if (hasChecks) {
        throw new Error(".omit() cannot be used on object schemas containing refinements");
      }
      const def = mergeDefs(schema._zod.def, {
        get shape() {
          const newShape = { ...schema._zod.def.shape };
          for (const key in mask) {
            if (!(key in currDef.shape)) {
              throw new Error(`Unrecognized key: "${key}"`);
            }
            if (!mask[key])
              continue;
            delete newShape[key];
          }
          assignProp(this, "shape", newShape);
          return newShape;
        },
        checks: []
      });
      return clone(schema, def);
    }
    __name(omit, "omit");
    function extend(schema, shape) {
      if (!isPlainObject(shape)) {
        throw new Error("Invalid input to extend: expected a plain object");
      }
      const checks = schema._zod.def.checks;
      const hasChecks = checks && checks.length > 0;
      if (hasChecks) {
        const existingShape = schema._zod.def.shape;
        for (const key in shape) {
          if (Object.getOwnPropertyDescriptor(existingShape, key) !== void 0) {
            throw new Error("Cannot overwrite keys on object schemas containing refinements. Use `.safeExtend()` instead.");
          }
        }
      }
      const def = mergeDefs(schema._zod.def, {
        get shape() {
          const _shape = { ...schema._zod.def.shape, ...shape };
          assignProp(this, "shape", _shape);
          return _shape;
        }
      });
      return clone(schema, def);
    }
    __name(extend, "extend");
    function safeExtend(schema, shape) {
      if (!isPlainObject(shape)) {
        throw new Error("Invalid input to safeExtend: expected a plain object");
      }
      const def = mergeDefs(schema._zod.def, {
        get shape() {
          const _shape = { ...schema._zod.def.shape, ...shape };
          assignProp(this, "shape", _shape);
          return _shape;
        }
      });
      return clone(schema, def);
    }
    __name(safeExtend, "safeExtend");
    function merge(a, b) {
      const def = mergeDefs(a._zod.def, {
        get shape() {
          const _shape = { ...a._zod.def.shape, ...b._zod.def.shape };
          assignProp(this, "shape", _shape);
          return _shape;
        },
        get catchall() {
          return b._zod.def.catchall;
        },
        checks: []
        // delete existing checks
      });
      return clone(a, def);
    }
    __name(merge, "merge");
    function partial(Class2, schema, mask) {
      const currDef = schema._zod.def;
      const checks = currDef.checks;
      const hasChecks = checks && checks.length > 0;
      if (hasChecks) {
        throw new Error(".partial() cannot be used on object schemas containing refinements");
      }
      const def = mergeDefs(schema._zod.def, {
        get shape() {
          const oldShape = schema._zod.def.shape;
          const shape = { ...oldShape };
          if (mask) {
            for (const key in mask) {
              if (!(key in oldShape)) {
                throw new Error(`Unrecognized key: "${key}"`);
              }
              if (!mask[key])
                continue;
              shape[key] = Class2 ? new Class2({
                type: "optional",
                innerType: oldShape[key]
              }) : oldShape[key];
            }
          } else {
            for (const key in oldShape) {
              shape[key] = Class2 ? new Class2({
                type: "optional",
                innerType: oldShape[key]
              }) : oldShape[key];
            }
          }
          assignProp(this, "shape", shape);
          return shape;
        },
        checks: []
      });
      return clone(schema, def);
    }
    __name(partial, "partial");
    function required(Class2, schema, mask) {
      const def = mergeDefs(schema._zod.def, {
        get shape() {
          const oldShape = schema._zod.def.shape;
          const shape = { ...oldShape };
          if (mask) {
            for (const key in mask) {
              if (!(key in shape)) {
                throw new Error(`Unrecognized key: "${key}"`);
              }
              if (!mask[key])
                continue;
              shape[key] = new Class2({
                type: "nonoptional",
                innerType: oldShape[key]
              });
            }
          } else {
            for (const key in oldShape) {
              shape[key] = new Class2({
                type: "nonoptional",
                innerType: oldShape[key]
              });
            }
          }
          assignProp(this, "shape", shape);
          return shape;
        }
      });
      return clone(schema, def);
    }
    __name(required, "required");
    function aborted(x, startIndex = 0) {
      if (x.aborted === true)
        return true;
      for (let i = startIndex; i < x.issues.length; i++) {
        if (x.issues[i]?.continue !== true) {
          return true;
        }
      }
      return false;
    }
    __name(aborted, "aborted");
    function prefixIssues(path5, issues) {
      return issues.map((iss) => {
        var _a;
        (_a = iss).path ?? (_a.path = []);
        iss.path.unshift(path5);
        return iss;
      });
    }
    __name(prefixIssues, "prefixIssues");
    function unwrapMessage(message) {
      return typeof message === "string" ? message : message?.message;
    }
    __name(unwrapMessage, "unwrapMessage");
    function finalizeIssue(iss, ctx, config) {
      const full = { ...iss, path: iss.path ?? [] };
      if (!iss.message) {
        const message = unwrapMessage(iss.inst?._zod.def?.error?.(iss)) ?? unwrapMessage(ctx?.error?.(iss)) ?? unwrapMessage(config.customError?.(iss)) ?? unwrapMessage(config.localeError?.(iss)) ?? "Invalid input";
        full.message = message;
      }
      delete full.inst;
      delete full.continue;
      if (!ctx?.reportInput) {
        delete full.input;
      }
      return full;
    }
    __name(finalizeIssue, "finalizeIssue");
    function getSizableOrigin(input) {
      if (input instanceof Set)
        return "set";
      if (input instanceof Map)
        return "map";
      if (input instanceof File)
        return "file";
      return "unknown";
    }
    __name(getSizableOrigin, "getSizableOrigin");
    function getLengthableOrigin(input) {
      if (Array.isArray(input))
        return "array";
      if (typeof input === "string")
        return "string";
      return "unknown";
    }
    __name(getLengthableOrigin, "getLengthableOrigin");
    function parsedType(data) {
      const t = typeof data;
      switch (t) {
        case "number": {
          return Number.isNaN(data) ? "nan" : "number";
        }
        case "object": {
          if (data === null) {
            return "null";
          }
          if (Array.isArray(data)) {
            return "array";
          }
          const obj = data;
          if (obj && Object.getPrototypeOf(obj) !== Object.prototype && "constructor" in obj && obj.constructor) {
            return obj.constructor.name;
          }
        }
      }
      return t;
    }
    __name(parsedType, "parsedType");
    function issue(...args) {
      const [iss, input, inst] = args;
      if (typeof iss === "string") {
        return {
          message: iss,
          code: "custom",
          input,
          inst
        };
      }
      return { ...iss };
    }
    __name(issue, "issue");
    function cleanEnum(obj) {
      return Object.entries(obj).filter(([k, _]) => {
        return Number.isNaN(Number.parseInt(k, 10));
      }).map((el) => el[1]);
    }
    __name(cleanEnum, "cleanEnum");
    function base64ToUint8Array(base64) {
      const binaryString = atob(base64);
      const bytes = new Uint8Array(binaryString.length);
      for (let i = 0; i < binaryString.length; i++) {
        bytes[i] = binaryString.charCodeAt(i);
      }
      return bytes;
    }
    __name(base64ToUint8Array, "base64ToUint8Array");
    function uint8ArrayToBase64(bytes) {
      let binaryString = "";
      for (let i = 0; i < bytes.length; i++) {
        binaryString += String.fromCharCode(bytes[i]);
      }
      return btoa(binaryString);
    }
    __name(uint8ArrayToBase64, "uint8ArrayToBase64");
    function base64urlToUint8Array(base64url) {
      const base64 = base64url.replace(/-/g, "+").replace(/_/g, "/");
      const padding = "=".repeat((4 - base64.length % 4) % 4);
      return base64ToUint8Array(base64 + padding);
    }
    __name(base64urlToUint8Array, "base64urlToUint8Array");
    function uint8ArrayToBase64url(bytes) {
      return uint8ArrayToBase64(bytes).replace(/\+/g, "-").replace(/\//g, "_").replace(/=/g, "");
    }
    __name(uint8ArrayToBase64url, "uint8ArrayToBase64url");
    function hexToUint8Array(hex) {
      const cleanHex = hex.replace(/^0x/, "");
      if (cleanHex.length % 2 !== 0) {
        throw new Error("Invalid hex string length");
      }
      const bytes = new Uint8Array(cleanHex.length / 2);
      for (let i = 0; i < cleanHex.length; i += 2) {
        bytes[i / 2] = Number.parseInt(cleanHex.slice(i, i + 2), 16);
      }
      return bytes;
    }
    __name(hexToUint8Array, "hexToUint8Array");
    function uint8ArrayToHex(bytes) {
      return Array.from(bytes).map((b) => b.toString(16).padStart(2, "0")).join("");
    }
    __name(uint8ArrayToHex, "uint8ArrayToHex");
    var Class = class {
      static {
        __name(this, "Class");
      }
      constructor(..._args) {
      }
    };
    exports2.Class = Class;
  }
});

// node_modules/zod/v4/core/errors.cjs
var require_errors2 = __commonJS({
  "node_modules/zod/v4/core/errors.cjs"(exports2) {
    "use strict";
    var __createBinding = exports2 && exports2.__createBinding || (Object.create ? (function(o, m, k, k2) {
      if (k2 === void 0) k2 = k;
      var desc = Object.getOwnPropertyDescriptor(m, k);
      if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
        desc = { enumerable: true, get: /* @__PURE__ */ __name(function() {
          return m[k];
        }, "get") };
      }
      Object.defineProperty(o, k2, desc);
    }) : (function(o, m, k, k2) {
      if (k2 === void 0) k2 = k;
      o[k2] = m[k];
    }));
    var __setModuleDefault = exports2 && exports2.__setModuleDefault || (Object.create ? (function(o, v) {
      Object.defineProperty(o, "default", { enumerable: true, value: v });
    }) : function(o, v) {
      o["default"] = v;
    });
    var __importStar = exports2 && exports2.__importStar || function(mod) {
      if (mod && mod.__esModule) return mod;
      var result = {};
      if (mod != null) {
        for (var k in mod) if (k !== "default" && Object.prototype.hasOwnProperty.call(mod, k)) __createBinding(result, mod, k);
      }
      __setModuleDefault(result, mod);
      return result;
    };
    Object.defineProperty(exports2, "__esModule", { value: true });
    exports2.$ZodRealError = exports2.$ZodError = void 0;
    exports2.flattenError = flattenError;
    exports2.formatError = formatError;
    exports2.treeifyError = treeifyError;
    exports2.toDotPath = toDotPath;
    exports2.prettifyError = prettifyError;
    var core_js_1 = require_core();
    var util = __importStar(require_util());
    var initializer = /* @__PURE__ */ __name((inst, def) => {
      inst.name = "$ZodError";
      Object.defineProperty(inst, "_zod", {
        value: inst._zod,
        enumerable: false
      });
      Object.defineProperty(inst, "issues", {
        value: def,
        enumerable: false
      });
      inst.message = JSON.stringify(def, util.jsonStringifyReplacer, 2);
      Object.defineProperty(inst, "toString", {
        value: /* @__PURE__ */ __name(() => inst.message, "value"),
        enumerable: false
      });
    }, "initializer");
    exports2.$ZodError = (0, core_js_1.$constructor)("$ZodError", initializer);
    exports2.$ZodRealError = (0, core_js_1.$constructor)("$ZodError", initializer, { Parent: Error });
    function flattenError(error, mapper = (issue) => issue.message) {
      const fieldErrors = {};
      const formErrors = [];
      for (const sub of error.issues) {
        if (sub.path.length > 0) {
          fieldErrors[sub.path[0]] = fieldErrors[sub.path[0]] || [];
          fieldErrors[sub.path[0]].push(mapper(sub));
        } else {
          formErrors.push(mapper(sub));
        }
      }
      return { formErrors, fieldErrors };
    }
    __name(flattenError, "flattenError");
    function formatError(error, mapper = (issue) => issue.message) {
      const fieldErrors = { _errors: [] };
      const processError = /* @__PURE__ */ __name((error2) => {
        for (const issue of error2.issues) {
          if (issue.code === "invalid_union" && issue.errors.length) {
            issue.errors.map((issues) => processError({ issues }));
          } else if (issue.code === "invalid_key") {
            processError({ issues: issue.issues });
          } else if (issue.code === "invalid_element") {
            processError({ issues: issue.issues });
          } else if (issue.path.length === 0) {
            fieldErrors._errors.push(mapper(issue));
          } else {
            let curr = fieldErrors;
            let i = 0;
            while (i < issue.path.length) {
              const el = issue.path[i];
              const terminal = i === issue.path.length - 1;
              if (!terminal) {
                curr[el] = curr[el] || { _errors: [] };
              } else {
                curr[el] = curr[el] || { _errors: [] };
                curr[el]._errors.push(mapper(issue));
              }
              curr = curr[el];
              i++;
            }
          }
        }
      }, "processError");
      processError(error);
      return fieldErrors;
    }
    __name(formatError, "formatError");
    function treeifyError(error, mapper = (issue) => issue.message) {
      const result = { errors: [] };
      const processError = /* @__PURE__ */ __name((error2, path5 = []) => {
        var _a, _b;
        for (const issue of error2.issues) {
          if (issue.code === "invalid_union" && issue.errors.length) {
            issue.errors.map((issues) => processError({ issues }, issue.path));
          } else if (issue.code === "invalid_key") {
            processError({ issues: issue.issues }, issue.path);
          } else if (issue.code === "invalid_element") {
            processError({ issues: issue.issues }, issue.path);
          } else {
            const fullpath = [...path5, ...issue.path];
            if (fullpath.length === 0) {
              result.errors.push(mapper(issue));
              continue;
            }
            let curr = result;
            let i = 0;
            while (i < fullpath.length) {
              const el = fullpath[i];
              const terminal = i === fullpath.length - 1;
              if (typeof el === "string") {
                curr.properties ?? (curr.properties = {});
                (_a = curr.properties)[el] ?? (_a[el] = { errors: [] });
                curr = curr.properties[el];
              } else {
                curr.items ?? (curr.items = []);
                (_b = curr.items)[el] ?? (_b[el] = { errors: [] });
                curr = curr.items[el];
              }
              if (terminal) {
                curr.errors.push(mapper(issue));
              }
              i++;
            }
          }
        }
      }, "processError");
      processError(error);
      return result;
    }
    __name(treeifyError, "treeifyError");
    function toDotPath(_path) {
      const segs = [];
      const path5 = _path.map((seg) => typeof seg === "object" ? seg.key : seg);
      for (const seg of path5) {
        if (typeof seg === "number")
          segs.push(`[${seg}]`);
        else if (typeof seg === "symbol")
          segs.push(`[${JSON.stringify(String(seg))}]`);
        else if (/[^\w$]/.test(seg))
          segs.push(`[${JSON.stringify(seg)}]`);
        else {
          if (segs.length)
            segs.push(".");
          segs.push(seg);
        }
      }
      return segs.join("");
    }
    __name(toDotPath, "toDotPath");
    function prettifyError(error) {
      const lines = [];
      const issues = [...error.issues].sort((a, b) => (a.path ?? []).length - (b.path ?? []).length);
      for (const issue of issues) {
        lines.push(`\u2716 ${issue.message}`);
        if (issue.path?.length)
          lines.push(`  \u2192 at ${toDotPath(issue.path)}`);
      }
      return lines.join("\n");
    }
    __name(prettifyError, "prettifyError");
  }
});

// node_modules/zod/v4/core/parse.cjs
var require_parse = __commonJS({
  "node_modules/zod/v4/core/parse.cjs"(exports2) {
    "use strict";
    var __createBinding = exports2 && exports2.__createBinding || (Object.create ? (function(o, m, k, k2) {
      if (k2 === void 0) k2 = k;
      var desc = Object.getOwnPropertyDescriptor(m, k);
      if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
        desc = { enumerable: true, get: /* @__PURE__ */ __name(function() {
          return m[k];
        }, "get") };
      }
      Object.defineProperty(o, k2, desc);
    }) : (function(o, m, k, k2) {
      if (k2 === void 0) k2 = k;
      o[k2] = m[k];
    }));
    var __setModuleDefault = exports2 && exports2.__setModuleDefault || (Object.create ? (function(o, v) {
      Object.defineProperty(o, "default", { enumerable: true, value: v });
    }) : function(o, v) {
      o["default"] = v;
    });
    var __importStar = exports2 && exports2.__importStar || function(mod) {
      if (mod && mod.__esModule) return mod;
      var result = {};
      if (mod != null) {
        for (var k in mod) if (k !== "default" && Object.prototype.hasOwnProperty.call(mod, k)) __createBinding(result, mod, k);
      }
      __setModuleDefault(result, mod);
      return result;
    };
    Object.defineProperty(exports2, "__esModule", { value: true });
    exports2.safeDecodeAsync = exports2._safeDecodeAsync = exports2.safeEncodeAsync = exports2._safeEncodeAsync = exports2.safeDecode = exports2._safeDecode = exports2.safeEncode = exports2._safeEncode = exports2.decodeAsync = exports2._decodeAsync = exports2.encodeAsync = exports2._encodeAsync = exports2.decode = exports2._decode = exports2.encode = exports2._encode = exports2.safeParseAsync = exports2._safeParseAsync = exports2.safeParse = exports2._safeParse = exports2.parseAsync = exports2._parseAsync = exports2.parse = exports2._parse = void 0;
    var core = __importStar(require_core());
    var errors = __importStar(require_errors2());
    var util = __importStar(require_util());
    var _parse = /* @__PURE__ */ __name((_Err) => (schema, value, _ctx, _params) => {
      const ctx = _ctx ? Object.assign(_ctx, { async: false }) : { async: false };
      const result = schema._zod.run({ value, issues: [] }, ctx);
      if (result instanceof Promise) {
        throw new core.$ZodAsyncError();
      }
      if (result.issues.length) {
        const e = new (_params?.Err ?? _Err)(result.issues.map((iss) => util.finalizeIssue(iss, ctx, core.config())));
        util.captureStackTrace(e, _params?.callee);
        throw e;
      }
      return result.value;
    }, "_parse");
    exports2._parse = _parse;
    exports2.parse = (0, exports2._parse)(errors.$ZodRealError);
    var _parseAsync = /* @__PURE__ */ __name((_Err) => async (schema, value, _ctx, params) => {
      const ctx = _ctx ? Object.assign(_ctx, { async: true }) : { async: true };
      let result = schema._zod.run({ value, issues: [] }, ctx);
      if (result instanceof Promise)
        result = await result;
      if (result.issues.length) {
        const e = new (params?.Err ?? _Err)(result.issues.map((iss) => util.finalizeIssue(iss, ctx, core.config())));
        util.captureStackTrace(e, params?.callee);
        throw e;
      }
      return result.value;
    }, "_parseAsync");
    exports2._parseAsync = _parseAsync;
    exports2.parseAsync = (0, exports2._parseAsync)(errors.$ZodRealError);
    var _safeParse = /* @__PURE__ */ __name((_Err) => (schema, value, _ctx) => {
      const ctx = _ctx ? { ..._ctx, async: false } : { async: false };
      const result = schema._zod.run({ value, issues: [] }, ctx);
      if (result instanceof Promise) {
        throw new core.$ZodAsyncError();
      }
      return result.issues.length ? {
        success: false,
        error: new (_Err ?? errors.$ZodError)(result.issues.map((iss) => util.finalizeIssue(iss, ctx, core.config())))
      } : { success: true, data: result.value };
    }, "_safeParse");
    exports2._safeParse = _safeParse;
    exports2.safeParse = (0, exports2._safeParse)(errors.$ZodRealError);
    var _safeParseAsync = /* @__PURE__ */ __name((_Err) => async (schema, value, _ctx) => {
      const ctx = _ctx ? Object.assign(_ctx, { async: true }) : { async: true };
      let result = schema._zod.run({ value, issues: [] }, ctx);
      if (result instanceof Promise)
        result = await result;
      return result.issues.length ? {
        success: false,
        error: new _Err(result.issues.map((iss) => util.finalizeIssue(iss, ctx, core.config())))
      } : { success: true, data: result.value };
    }, "_safeParseAsync");
    exports2._safeParseAsync = _safeParseAsync;
    exports2.safeParseAsync = (0, exports2._safeParseAsync)(errors.$ZodRealError);
    var _encode = /* @__PURE__ */ __name((_Err) => (schema, value, _ctx) => {
      const ctx = _ctx ? Object.assign(_ctx, { direction: "backward" }) : { direction: "backward" };
      return (0, exports2._parse)(_Err)(schema, value, ctx);
    }, "_encode");
    exports2._encode = _encode;
    exports2.encode = (0, exports2._encode)(errors.$ZodRealError);
    var _decode = /* @__PURE__ */ __name((_Err) => (schema, value, _ctx) => {
      return (0, exports2._parse)(_Err)(schema, value, _ctx);
    }, "_decode");
    exports2._decode = _decode;
    exports2.decode = (0, exports2._decode)(errors.$ZodRealError);
    var _encodeAsync = /* @__PURE__ */ __name((_Err) => async (schema, value, _ctx) => {
      const ctx = _ctx ? Object.assign(_ctx, { direction: "backward" }) : { direction: "backward" };
      return (0, exports2._parseAsync)(_Err)(schema, value, ctx);
    }, "_encodeAsync");
    exports2._encodeAsync = _encodeAsync;
    exports2.encodeAsync = (0, exports2._encodeAsync)(errors.$ZodRealError);
    var _decodeAsync = /* @__PURE__ */ __name((_Err) => async (schema, value, _ctx) => {
      return (0, exports2._parseAsync)(_Err)(schema, value, _ctx);
    }, "_decodeAsync");
    exports2._decodeAsync = _decodeAsync;
    exports2.decodeAsync = (0, exports2._decodeAsync)(errors.$ZodRealError);
    var _safeEncode = /* @__PURE__ */ __name((_Err) => (schema, value, _ctx) => {
      const ctx = _ctx ? Object.assign(_ctx, { direction: "backward" }) : { direction: "backward" };
      return (0, exports2._safeParse)(_Err)(schema, value, ctx);
    }, "_safeEncode");
    exports2._safeEncode = _safeEncode;
    exports2.safeEncode = (0, exports2._safeEncode)(errors.$ZodRealError);
    var _safeDecode = /* @__PURE__ */ __name((_Err) => (schema, value, _ctx) => {
      return (0, exports2._safeParse)(_Err)(schema, value, _ctx);
    }, "_safeDecode");
    exports2._safeDecode = _safeDecode;
    exports2.safeDecode = (0, exports2._safeDecode)(errors.$ZodRealError);
    var _safeEncodeAsync = /* @__PURE__ */ __name((_Err) => async (schema, value, _ctx) => {
      const ctx = _ctx ? Object.assign(_ctx, { direction: "backward" }) : { direction: "backward" };
      return (0, exports2._safeParseAsync)(_Err)(schema, value, ctx);
    }, "_safeEncodeAsync");
    exports2._safeEncodeAsync = _safeEncodeAsync;
    exports2.safeEncodeAsync = (0, exports2._safeEncodeAsync)(errors.$ZodRealError);
    var _safeDecodeAsync = /* @__PURE__ */ __name((_Err) => async (schema, value, _ctx) => {
      return (0, exports2._safeParseAsync)(_Err)(schema, value, _ctx);
    }, "_safeDecodeAsync");
    exports2._safeDecodeAsync = _safeDecodeAsync;
    exports2.safeDecodeAsync = (0, exports2._safeDecodeAsync)(errors.$ZodRealError);
  }
});

// node_modules/zod/v4/core/regexes.cjs
var require_regexes = __commonJS({
  "node_modules/zod/v4/core/regexes.cjs"(exports2) {
    "use strict";
    var __createBinding = exports2 && exports2.__createBinding || (Object.create ? (function(o, m, k, k2) {
      if (k2 === void 0) k2 = k;
      var desc = Object.getOwnPropertyDescriptor(m, k);
      if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
        desc = { enumerable: true, get: /* @__PURE__ */ __name(function() {
          return m[k];
        }, "get") };
      }
      Object.defineProperty(o, k2, desc);
    }) : (function(o, m, k, k2) {
      if (k2 === void 0) k2 = k;
      o[k2] = m[k];
    }));
    var __setModuleDefault = exports2 && exports2.__setModuleDefault || (Object.create ? (function(o, v) {
      Object.defineProperty(o, "default", { enumerable: true, value: v });
    }) : function(o, v) {
      o["default"] = v;
    });
    var __importStar = exports2 && exports2.__importStar || function(mod) {
      if (mod && mod.__esModule) return mod;
      var result = {};
      if (mod != null) {
        for (var k in mod) if (k !== "default" && Object.prototype.hasOwnProperty.call(mod, k)) __createBinding(result, mod, k);
      }
      __setModuleDefault(result, mod);
      return result;
    };
    Object.defineProperty(exports2, "__esModule", { value: true });
    exports2.sha384_hex = exports2.sha256_base64url = exports2.sha256_base64 = exports2.sha256_hex = exports2.sha1_base64url = exports2.sha1_base64 = exports2.sha1_hex = exports2.md5_base64url = exports2.md5_base64 = exports2.md5_hex = exports2.hex = exports2.uppercase = exports2.lowercase = exports2.undefined = exports2.null = exports2.boolean = exports2.number = exports2.integer = exports2.bigint = exports2.string = exports2.date = exports2.e164 = exports2.domain = exports2.hostname = exports2.base64url = exports2.base64 = exports2.cidrv6 = exports2.cidrv4 = exports2.mac = exports2.ipv6 = exports2.ipv4 = exports2.browserEmail = exports2.idnEmail = exports2.unicodeEmail = exports2.rfc5322Email = exports2.html5Email = exports2.email = exports2.uuid7 = exports2.uuid6 = exports2.uuid4 = exports2.uuid = exports2.guid = exports2.extendedDuration = exports2.duration = exports2.nanoid = exports2.ksuid = exports2.xid = exports2.ulid = exports2.cuid2 = exports2.cuid = void 0;
    exports2.sha512_base64url = exports2.sha512_base64 = exports2.sha512_hex = exports2.sha384_base64url = exports2.sha384_base64 = void 0;
    exports2.emoji = emoji;
    exports2.time = time;
    exports2.datetime = datetime;
    var util = __importStar(require_util());
    exports2.cuid = /^[cC][^\s-]{8,}$/;
    exports2.cuid2 = /^[0-9a-z]+$/;
    exports2.ulid = /^[0-9A-HJKMNP-TV-Za-hjkmnp-tv-z]{26}$/;
    exports2.xid = /^[0-9a-vA-V]{20}$/;
    exports2.ksuid = /^[A-Za-z0-9]{27}$/;
    exports2.nanoid = /^[a-zA-Z0-9_-]{21}$/;
    exports2.duration = /^P(?:(\d+W)|(?!.*W)(?=\d|T\d)(\d+Y)?(\d+M)?(\d+D)?(T(?=\d)(\d+H)?(\d+M)?(\d+([.,]\d+)?S)?)?)$/;
    exports2.extendedDuration = /^[-+]?P(?!$)(?:(?:[-+]?\d+Y)|(?:[-+]?\d+[.,]\d+Y$))?(?:(?:[-+]?\d+M)|(?:[-+]?\d+[.,]\d+M$))?(?:(?:[-+]?\d+W)|(?:[-+]?\d+[.,]\d+W$))?(?:(?:[-+]?\d+D)|(?:[-+]?\d+[.,]\d+D$))?(?:T(?=[\d+-])(?:(?:[-+]?\d+H)|(?:[-+]?\d+[.,]\d+H$))?(?:(?:[-+]?\d+M)|(?:[-+]?\d+[.,]\d+M$))?(?:[-+]?\d+(?:[.,]\d+)?S)?)??$/;
    exports2.guid = /^([0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12})$/;
    var uuid = /* @__PURE__ */ __name((version) => {
      if (!version)
        return /^([0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-8][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}|00000000-0000-0000-0000-000000000000|ffffffff-ffff-ffff-ffff-ffffffffffff)$/;
      return new RegExp(`^([0-9a-fA-F]{8}-[0-9a-fA-F]{4}-${version}[0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12})$`);
    }, "uuid");
    exports2.uuid = uuid;
    exports2.uuid4 = (0, exports2.uuid)(4);
    exports2.uuid6 = (0, exports2.uuid)(6);
    exports2.uuid7 = (0, exports2.uuid)(7);
    exports2.email = /^(?!\.)(?!.*\.\.)([A-Za-z0-9_'+\-\.]*)[A-Za-z0-9_+-]@([A-Za-z0-9][A-Za-z0-9\-]*\.)+[A-Za-z]{2,}$/;
    exports2.html5Email = /^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)*$/;
    exports2.rfc5322Email = /^(([^<>()\[\]\\.,;:\s@"]+(\.[^<>()\[\]\\.,;:\s@"]+)*)|(".+"))@((\[[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}])|(([a-zA-Z\-0-9]+\.)+[a-zA-Z]{2,}))$/;
    exports2.unicodeEmail = /^[^\s@"]{1,64}@[^\s@]{1,255}$/u;
    exports2.idnEmail = exports2.unicodeEmail;
    exports2.browserEmail = /^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)*$/;
    var _emoji = `^(\\p{Extended_Pictographic}|\\p{Emoji_Component})+$`;
    function emoji() {
      return new RegExp(_emoji, "u");
    }
    __name(emoji, "emoji");
    exports2.ipv4 = /^(?:(?:25[0-5]|2[0-4][0-9]|1[0-9][0-9]|[1-9][0-9]|[0-9])\.){3}(?:25[0-5]|2[0-4][0-9]|1[0-9][0-9]|[1-9][0-9]|[0-9])$/;
    exports2.ipv6 = /^(([0-9a-fA-F]{1,4}:){7}[0-9a-fA-F]{1,4}|([0-9a-fA-F]{1,4}:){1,7}:|([0-9a-fA-F]{1,4}:){1,6}:[0-9a-fA-F]{1,4}|([0-9a-fA-F]{1,4}:){1,5}(:[0-9a-fA-F]{1,4}){1,2}|([0-9a-fA-F]{1,4}:){1,4}(:[0-9a-fA-F]{1,4}){1,3}|([0-9a-fA-F]{1,4}:){1,3}(:[0-9a-fA-F]{1,4}){1,4}|([0-9a-fA-F]{1,4}:){1,2}(:[0-9a-fA-F]{1,4}){1,5}|[0-9a-fA-F]{1,4}:((:[0-9a-fA-F]{1,4}){1,6})|:((:[0-9a-fA-F]{1,4}){1,7}|:))$/;
    var mac = /* @__PURE__ */ __name((delimiter) => {
      const escapedDelim = util.escapeRegex(delimiter ?? ":");
      return new RegExp(`^(?:[0-9A-F]{2}${escapedDelim}){5}[0-9A-F]{2}$|^(?:[0-9a-f]{2}${escapedDelim}){5}[0-9a-f]{2}$`);
    }, "mac");
    exports2.mac = mac;
    exports2.cidrv4 = /^((25[0-5]|2[0-4][0-9]|1[0-9][0-9]|[1-9][0-9]|[0-9])\.){3}(25[0-5]|2[0-4][0-9]|1[0-9][0-9]|[1-9][0-9]|[0-9])\/([0-9]|[1-2][0-9]|3[0-2])$/;
    exports2.cidrv6 = /^(([0-9a-fA-F]{1,4}:){7}[0-9a-fA-F]{1,4}|::|([0-9a-fA-F]{1,4})?::([0-9a-fA-F]{1,4}:?){0,6})\/(12[0-8]|1[01][0-9]|[1-9]?[0-9])$/;
    exports2.base64 = /^$|^(?:[0-9a-zA-Z+/]{4})*(?:(?:[0-9a-zA-Z+/]{2}==)|(?:[0-9a-zA-Z+/]{3}=))?$/;
    exports2.base64url = /^[A-Za-z0-9_-]*$/;
    exports2.hostname = /^(?=.{1,253}\.?$)[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[-0-9a-zA-Z]{0,61}[0-9a-zA-Z])?)*\.?$/;
    exports2.domain = /^([a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?\.)+[a-zA-Z]{2,}$/;
    exports2.e164 = /^\+[1-9]\d{6,14}$/;
    var dateSource = `(?:(?:\\d\\d[2468][048]|\\d\\d[13579][26]|\\d\\d0[48]|[02468][048]00|[13579][26]00)-02-29|\\d{4}-(?:(?:0[13578]|1[02])-(?:0[1-9]|[12]\\d|3[01])|(?:0[469]|11)-(?:0[1-9]|[12]\\d|30)|(?:02)-(?:0[1-9]|1\\d|2[0-8])))`;
    exports2.date = new RegExp(`^${dateSource}$`);
    function timeSource(args) {
      const hhmm = `(?:[01]\\d|2[0-3]):[0-5]\\d`;
      const regex = typeof args.precision === "number" ? args.precision === -1 ? `${hhmm}` : args.precision === 0 ? `${hhmm}:[0-5]\\d` : `${hhmm}:[0-5]\\d\\.\\d{${args.precision}}` : `${hhmm}(?::[0-5]\\d(?:\\.\\d+)?)?`;
      return regex;
    }
    __name(timeSource, "timeSource");
    function time(args) {
      return new RegExp(`^${timeSource(args)}$`);
    }
    __name(time, "time");
    function datetime(args) {
      const time2 = timeSource({ precision: args.precision });
      const opts = ["Z"];
      if (args.local)
        opts.push("");
      if (args.offset)
        opts.push(`([+-](?:[01]\\d|2[0-3]):[0-5]\\d)`);
      const timeRegex = `${time2}(?:${opts.join("|")})`;
      return new RegExp(`^${dateSource}T(?:${timeRegex})$`);
    }
    __name(datetime, "datetime");
    var string = /* @__PURE__ */ __name((params) => {
      const regex = params ? `[\\s\\S]{${params?.minimum ?? 0},${params?.maximum ?? ""}}` : `[\\s\\S]*`;
      return new RegExp(`^${regex}$`);
    }, "string");
    exports2.string = string;
    exports2.bigint = /^-?\d+n?$/;
    exports2.integer = /^-?\d+$/;
    exports2.number = /^-?\d+(?:\.\d+)?$/;
    exports2.boolean = /^(?:true|false)$/i;
    var _null = /^null$/i;
    exports2.null = _null;
    var _undefined = /^undefined$/i;
    exports2.undefined = _undefined;
    exports2.lowercase = /^[^A-Z]*$/;
    exports2.uppercase = /^[^a-z]*$/;
    exports2.hex = /^[0-9a-fA-F]*$/;
    function fixedBase64(bodyLength, padding) {
      return new RegExp(`^[A-Za-z0-9+/]{${bodyLength}}${padding}$`);
    }
    __name(fixedBase64, "fixedBase64");
    function fixedBase64url(length) {
      return new RegExp(`^[A-Za-z0-9_-]{${length}}$`);
    }
    __name(fixedBase64url, "fixedBase64url");
    exports2.md5_hex = /^[0-9a-fA-F]{32}$/;
    exports2.md5_base64 = fixedBase64(22, "==");
    exports2.md5_base64url = fixedBase64url(22);
    exports2.sha1_hex = /^[0-9a-fA-F]{40}$/;
    exports2.sha1_base64 = fixedBase64(27, "=");
    exports2.sha1_base64url = fixedBase64url(27);
    exports2.sha256_hex = /^[0-9a-fA-F]{64}$/;
    exports2.sha256_base64 = fixedBase64(43, "=");
    exports2.sha256_base64url = fixedBase64url(43);
    exports2.sha384_hex = /^[0-9a-fA-F]{96}$/;
    exports2.sha384_base64 = fixedBase64(64, "");
    exports2.sha384_base64url = fixedBase64url(64);
    exports2.sha512_hex = /^[0-9a-fA-F]{128}$/;
    exports2.sha512_base64 = fixedBase64(86, "==");
    exports2.sha512_base64url = fixedBase64url(86);
  }
});

// node_modules/zod/v4/core/checks.cjs
var require_checks = __commonJS({
  "node_modules/zod/v4/core/checks.cjs"(exports2) {
    "use strict";
    var __createBinding = exports2 && exports2.__createBinding || (Object.create ? (function(o, m, k, k2) {
      if (k2 === void 0) k2 = k;
      var desc = Object.getOwnPropertyDescriptor(m, k);
      if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
        desc = { enumerable: true, get: /* @__PURE__ */ __name(function() {
          return m[k];
        }, "get") };
      }
      Object.defineProperty(o, k2, desc);
    }) : (function(o, m, k, k2) {
      if (k2 === void 0) k2 = k;
      o[k2] = m[k];
    }));
    var __setModuleDefault = exports2 && exports2.__setModuleDefault || (Object.create ? (function(o, v) {
      Object.defineProperty(o, "default", { enumerable: true, value: v });
    }) : function(o, v) {
      o["default"] = v;
    });
    var __importStar = exports2 && exports2.__importStar || function(mod) {
      if (mod && mod.__esModule) return mod;
      var result = {};
      if (mod != null) {
        for (var k in mod) if (k !== "default" && Object.prototype.hasOwnProperty.call(mod, k)) __createBinding(result, mod, k);
      }
      __setModuleDefault(result, mod);
      return result;
    };
    Object.defineProperty(exports2, "__esModule", { value: true });
    exports2.$ZodCheckOverwrite = exports2.$ZodCheckMimeType = exports2.$ZodCheckProperty = exports2.$ZodCheckEndsWith = exports2.$ZodCheckStartsWith = exports2.$ZodCheckIncludes = exports2.$ZodCheckUpperCase = exports2.$ZodCheckLowerCase = exports2.$ZodCheckRegex = exports2.$ZodCheckStringFormat = exports2.$ZodCheckLengthEquals = exports2.$ZodCheckMinLength = exports2.$ZodCheckMaxLength = exports2.$ZodCheckSizeEquals = exports2.$ZodCheckMinSize = exports2.$ZodCheckMaxSize = exports2.$ZodCheckBigIntFormat = exports2.$ZodCheckNumberFormat = exports2.$ZodCheckMultipleOf = exports2.$ZodCheckGreaterThan = exports2.$ZodCheckLessThan = exports2.$ZodCheck = void 0;
    var core = __importStar(require_core());
    var regexes = __importStar(require_regexes());
    var util = __importStar(require_util());
    exports2.$ZodCheck = core.$constructor("$ZodCheck", (inst, def) => {
      var _a;
      inst._zod ?? (inst._zod = {});
      inst._zod.def = def;
      (_a = inst._zod).onattach ?? (_a.onattach = []);
    });
    var numericOriginMap = {
      number: "number",
      bigint: "bigint",
      object: "date"
    };
    exports2.$ZodCheckLessThan = core.$constructor("$ZodCheckLessThan", (inst, def) => {
      exports2.$ZodCheck.init(inst, def);
      const origin = numericOriginMap[typeof def.value];
      inst._zod.onattach.push((inst2) => {
        const bag = inst2._zod.bag;
        const curr = (def.inclusive ? bag.maximum : bag.exclusiveMaximum) ?? Number.POSITIVE_INFINITY;
        if (def.value < curr) {
          if (def.inclusive)
            bag.maximum = def.value;
          else
            bag.exclusiveMaximum = def.value;
        }
      });
      inst._zod.check = (payload) => {
        if (def.inclusive ? payload.value <= def.value : payload.value < def.value) {
          return;
        }
        payload.issues.push({
          origin,
          code: "too_big",
          maximum: typeof def.value === "object" ? def.value.getTime() : def.value,
          input: payload.value,
          inclusive: def.inclusive,
          inst,
          continue: !def.abort
        });
      };
    });
    exports2.$ZodCheckGreaterThan = core.$constructor("$ZodCheckGreaterThan", (inst, def) => {
      exports2.$ZodCheck.init(inst, def);
      const origin = numericOriginMap[typeof def.value];
      inst._zod.onattach.push((inst2) => {
        const bag = inst2._zod.bag;
        const curr = (def.inclusive ? bag.minimum : bag.exclusiveMinimum) ?? Number.NEGATIVE_INFINITY;
        if (def.value > curr) {
          if (def.inclusive)
            bag.minimum = def.value;
          else
            bag.exclusiveMinimum = def.value;
        }
      });
      inst._zod.check = (payload) => {
        if (def.inclusive ? payload.value >= def.value : payload.value > def.value) {
          return;
        }
        payload.issues.push({
          origin,
          code: "too_small",
          minimum: typeof def.value === "object" ? def.value.getTime() : def.value,
          input: payload.value,
          inclusive: def.inclusive,
          inst,
          continue: !def.abort
        });
      };
    });
    exports2.$ZodCheckMultipleOf = /* @__PURE__ */ core.$constructor("$ZodCheckMultipleOf", (inst, def) => {
      exports2.$ZodCheck.init(inst, def);
      inst._zod.onattach.push((inst2) => {
        var _a;
        (_a = inst2._zod.bag).multipleOf ?? (_a.multipleOf = def.value);
      });
      inst._zod.check = (payload) => {
        if (typeof payload.value !== typeof def.value)
          throw new Error("Cannot mix number and bigint in multiple_of check.");
        const isMultiple = typeof payload.value === "bigint" ? payload.value % def.value === BigInt(0) : util.floatSafeRemainder(payload.value, def.value) === 0;
        if (isMultiple)
          return;
        payload.issues.push({
          origin: typeof payload.value,
          code: "not_multiple_of",
          divisor: def.value,
          input: payload.value,
          inst,
          continue: !def.abort
        });
      };
    });
    exports2.$ZodCheckNumberFormat = core.$constructor("$ZodCheckNumberFormat", (inst, def) => {
      exports2.$ZodCheck.init(inst, def);
      def.format = def.format || "float64";
      const isInt = def.format?.includes("int");
      const origin = isInt ? "int" : "number";
      const [minimum, maximum] = util.NUMBER_FORMAT_RANGES[def.format];
      inst._zod.onattach.push((inst2) => {
        const bag = inst2._zod.bag;
        bag.format = def.format;
        bag.minimum = minimum;
        bag.maximum = maximum;
        if (isInt)
          bag.pattern = regexes.integer;
      });
      inst._zod.check = (payload) => {
        const input = payload.value;
        if (isInt) {
          if (!Number.isInteger(input)) {
            payload.issues.push({
              expected: origin,
              format: def.format,
              code: "invalid_type",
              continue: false,
              input,
              inst
            });
            return;
          }
          if (!Number.isSafeInteger(input)) {
            if (input > 0) {
              payload.issues.push({
                input,
                code: "too_big",
                maximum: Number.MAX_SAFE_INTEGER,
                note: "Integers must be within the safe integer range.",
                inst,
                origin,
                inclusive: true,
                continue: !def.abort
              });
            } else {
              payload.issues.push({
                input,
                code: "too_small",
                minimum: Number.MIN_SAFE_INTEGER,
                note: "Integers must be within the safe integer range.",
                inst,
                origin,
                inclusive: true,
                continue: !def.abort
              });
            }
            return;
          }
        }
        if (input < minimum) {
          payload.issues.push({
            origin: "number",
            input,
            code: "too_small",
            minimum,
            inclusive: true,
            inst,
            continue: !def.abort
          });
        }
        if (input > maximum) {
          payload.issues.push({
            origin: "number",
            input,
            code: "too_big",
            maximum,
            inclusive: true,
            inst,
            continue: !def.abort
          });
        }
      };
    });
    exports2.$ZodCheckBigIntFormat = core.$constructor("$ZodCheckBigIntFormat", (inst, def) => {
      exports2.$ZodCheck.init(inst, def);
      const [minimum, maximum] = util.BIGINT_FORMAT_RANGES[def.format];
      inst._zod.onattach.push((inst2) => {
        const bag = inst2._zod.bag;
        bag.format = def.format;
        bag.minimum = minimum;
        bag.maximum = maximum;
      });
      inst._zod.check = (payload) => {
        const input = payload.value;
        if (input < minimum) {
          payload.issues.push({
            origin: "bigint",
            input,
            code: "too_small",
            minimum,
            inclusive: true,
            inst,
            continue: !def.abort
          });
        }
        if (input > maximum) {
          payload.issues.push({
            origin: "bigint",
            input,
            code: "too_big",
            maximum,
            inclusive: true,
            inst,
            continue: !def.abort
          });
        }
      };
    });
    exports2.$ZodCheckMaxSize = core.$constructor("$ZodCheckMaxSize", (inst, def) => {
      var _a;
      exports2.$ZodCheck.init(inst, def);
      (_a = inst._zod.def).when ?? (_a.when = (payload) => {
        const val = payload.value;
        return !util.nullish(val) && val.size !== void 0;
      });
      inst._zod.onattach.push((inst2) => {
        const curr = inst2._zod.bag.maximum ?? Number.POSITIVE_INFINITY;
        if (def.maximum < curr)
          inst2._zod.bag.maximum = def.maximum;
      });
      inst._zod.check = (payload) => {
        const input = payload.value;
        const size = input.size;
        if (size <= def.maximum)
          return;
        payload.issues.push({
          origin: util.getSizableOrigin(input),
          code: "too_big",
          maximum: def.maximum,
          inclusive: true,
          input,
          inst,
          continue: !def.abort
        });
      };
    });
    exports2.$ZodCheckMinSize = core.$constructor("$ZodCheckMinSize", (inst, def) => {
      var _a;
      exports2.$ZodCheck.init(inst, def);
      (_a = inst._zod.def).when ?? (_a.when = (payload) => {
        const val = payload.value;
        return !util.nullish(val) && val.size !== void 0;
      });
      inst._zod.onattach.push((inst2) => {
        const curr = inst2._zod.bag.minimum ?? Number.NEGATIVE_INFINITY;
        if (def.minimum > curr)
          inst2._zod.bag.minimum = def.minimum;
      });
      inst._zod.check = (payload) => {
        const input = payload.value;
        const size = input.size;
        if (size >= def.minimum)
          return;
        payload.issues.push({
          origin: util.getSizableOrigin(input),
          code: "too_small",
          minimum: def.minimum,
          inclusive: true,
          input,
          inst,
          continue: !def.abort
        });
      };
    });
    exports2.$ZodCheckSizeEquals = core.$constructor("$ZodCheckSizeEquals", (inst, def) => {
      var _a;
      exports2.$ZodCheck.init(inst, def);
      (_a = inst._zod.def).when ?? (_a.when = (payload) => {
        const val = payload.value;
        return !util.nullish(val) && val.size !== void 0;
      });
      inst._zod.onattach.push((inst2) => {
        const bag = inst2._zod.bag;
        bag.minimum = def.size;
        bag.maximum = def.size;
        bag.size = def.size;
      });
      inst._zod.check = (payload) => {
        const input = payload.value;
        const size = input.size;
        if (size === def.size)
          return;
        const tooBig = size > def.size;
        payload.issues.push({
          origin: util.getSizableOrigin(input),
          ...tooBig ? { code: "too_big", maximum: def.size } : { code: "too_small", minimum: def.size },
          inclusive: true,
          exact: true,
          input: payload.value,
          inst,
          continue: !def.abort
        });
      };
    });
    exports2.$ZodCheckMaxLength = core.$constructor("$ZodCheckMaxLength", (inst, def) => {
      var _a;
      exports2.$ZodCheck.init(inst, def);
      (_a = inst._zod.def).when ?? (_a.when = (payload) => {
        const val = payload.value;
        return !util.nullish(val) && val.length !== void 0;
      });
      inst._zod.onattach.push((inst2) => {
        const curr = inst2._zod.bag.maximum ?? Number.POSITIVE_INFINITY;
        if (def.maximum < curr)
          inst2._zod.bag.maximum = def.maximum;
      });
      inst._zod.check = (payload) => {
        const input = payload.value;
        const length = input.length;
        if (length <= def.maximum)
          return;
        const origin = util.getLengthableOrigin(input);
        payload.issues.push({
          origin,
          code: "too_big",
          maximum: def.maximum,
          inclusive: true,
          input,
          inst,
          continue: !def.abort
        });
      };
    });
    exports2.$ZodCheckMinLength = core.$constructor("$ZodCheckMinLength", (inst, def) => {
      var _a;
      exports2.$ZodCheck.init(inst, def);
      (_a = inst._zod.def).when ?? (_a.when = (payload) => {
        const val = payload.value;
        return !util.nullish(val) && val.length !== void 0;
      });
      inst._zod.onattach.push((inst2) => {
        const curr = inst2._zod.bag.minimum ?? Number.NEGATIVE_INFINITY;
        if (def.minimum > curr)
          inst2._zod.bag.minimum = def.minimum;
      });
      inst._zod.check = (payload) => {
        const input = payload.value;
        const length = input.length;
        if (length >= def.minimum)
          return;
        const origin = util.getLengthableOrigin(input);
        payload.issues.push({
          origin,
          code: "too_small",
          minimum: def.minimum,
          inclusive: true,
          input,
          inst,
          continue: !def.abort
        });
      };
    });
    exports2.$ZodCheckLengthEquals = core.$constructor("$ZodCheckLengthEquals", (inst, def) => {
      var _a;
      exports2.$ZodCheck.init(inst, def);
      (_a = inst._zod.def).when ?? (_a.when = (payload) => {
        const val = payload.value;
        return !util.nullish(val) && val.length !== void 0;
      });
      inst._zod.onattach.push((inst2) => {
        const bag = inst2._zod.bag;
        bag.minimum = def.length;
        bag.maximum = def.length;
        bag.length = def.length;
      });
      inst._zod.check = (payload) => {
        const input = payload.value;
        const length = input.length;
        if (length === def.length)
          return;
        const origin = util.getLengthableOrigin(input);
        const tooBig = length > def.length;
        payload.issues.push({
          origin,
          ...tooBig ? { code: "too_big", maximum: def.length } : { code: "too_small", minimum: def.length },
          inclusive: true,
          exact: true,
          input: payload.value,
          inst,
          continue: !def.abort
        });
      };
    });
    exports2.$ZodCheckStringFormat = core.$constructor("$ZodCheckStringFormat", (inst, def) => {
      var _a, _b;
      exports2.$ZodCheck.init(inst, def);
      inst._zod.onattach.push((inst2) => {
        const bag = inst2._zod.bag;
        bag.format = def.format;
        if (def.pattern) {
          bag.patterns ?? (bag.patterns = /* @__PURE__ */ new Set());
          bag.patterns.add(def.pattern);
        }
      });
      if (def.pattern)
        (_a = inst._zod).check ?? (_a.check = (payload) => {
          def.pattern.lastIndex = 0;
          if (def.pattern.test(payload.value))
            return;
          payload.issues.push({
            origin: "string",
            code: "invalid_format",
            format: def.format,
            input: payload.value,
            ...def.pattern ? { pattern: def.pattern.toString() } : {},
            inst,
            continue: !def.abort
          });
        });
      else
        (_b = inst._zod).check ?? (_b.check = () => {
        });
    });
    exports2.$ZodCheckRegex = core.$constructor("$ZodCheckRegex", (inst, def) => {
      exports2.$ZodCheckStringFormat.init(inst, def);
      inst._zod.check = (payload) => {
        def.pattern.lastIndex = 0;
        if (def.pattern.test(payload.value))
          return;
        payload.issues.push({
          origin: "string",
          code: "invalid_format",
          format: "regex",
          input: payload.value,
          pattern: def.pattern.toString(),
          inst,
          continue: !def.abort
        });
      };
    });
    exports2.$ZodCheckLowerCase = core.$constructor("$ZodCheckLowerCase", (inst, def) => {
      def.pattern ?? (def.pattern = regexes.lowercase);
      exports2.$ZodCheckStringFormat.init(inst, def);
    });
    exports2.$ZodCheckUpperCase = core.$constructor("$ZodCheckUpperCase", (inst, def) => {
      def.pattern ?? (def.pattern = regexes.uppercase);
      exports2.$ZodCheckStringFormat.init(inst, def);
    });
    exports2.$ZodCheckIncludes = core.$constructor("$ZodCheckIncludes", (inst, def) => {
      exports2.$ZodCheck.init(inst, def);
      const escapedRegex = util.escapeRegex(def.includes);
      const pattern = new RegExp(typeof def.position === "number" ? `^.{${def.position}}${escapedRegex}` : escapedRegex);
      def.pattern = pattern;
      inst._zod.onattach.push((inst2) => {
        const bag = inst2._zod.bag;
        bag.patterns ?? (bag.patterns = /* @__PURE__ */ new Set());
        bag.patterns.add(pattern);
      });
      inst._zod.check = (payload) => {
        if (payload.value.includes(def.includes, def.position))
          return;
        payload.issues.push({
          origin: "string",
          code: "invalid_format",
          format: "includes",
          includes: def.includes,
          input: payload.value,
          inst,
          continue: !def.abort
        });
      };
    });
    exports2.$ZodCheckStartsWith = core.$constructor("$ZodCheckStartsWith", (inst, def) => {
      exports2.$ZodCheck.init(inst, def);
      const pattern = new RegExp(`^${util.escapeRegex(def.prefix)}.*`);
      def.pattern ?? (def.pattern = pattern);
      inst._zod.onattach.push((inst2) => {
        const bag = inst2._zod.bag;
        bag.patterns ?? (bag.patterns = /* @__PURE__ */ new Set());
        bag.patterns.add(pattern);
      });
      inst._zod.check = (payload) => {
        if (payload.value.startsWith(def.prefix))
          return;
        payload.issues.push({
          origin: "string",
          code: "invalid_format",
          format: "starts_with",
          prefix: def.prefix,
          input: payload.value,
          inst,
          continue: !def.abort
        });
      };
    });
    exports2.$ZodCheckEndsWith = core.$constructor("$ZodCheckEndsWith", (inst, def) => {
      exports2.$ZodCheck.init(inst, def);
      const pattern = new RegExp(`.*${util.escapeRegex(def.suffix)}$`);
      def.pattern ?? (def.pattern = pattern);
      inst._zod.onattach.push((inst2) => {
        const bag = inst2._zod.bag;
        bag.patterns ?? (bag.patterns = /* @__PURE__ */ new Set());
        bag.patterns.add(pattern);
      });
      inst._zod.check = (payload) => {
        if (payload.value.endsWith(def.suffix))
          return;
        payload.issues.push({
          origin: "string",
          code: "invalid_format",
          format: "ends_with",
          suffix: def.suffix,
          input: payload.value,
          inst,
          continue: !def.abort
        });
      };
    });
    function handleCheckPropertyResult(result, payload, property) {
      if (result.issues.length) {
        payload.issues.push(...util.prefixIssues(property, result.issues));
      }
    }
    __name(handleCheckPropertyResult, "handleCheckPropertyResult");
    exports2.$ZodCheckProperty = core.$constructor("$ZodCheckProperty", (inst, def) => {
      exports2.$ZodCheck.init(inst, def);
      inst._zod.check = (payload) => {
        const result = def.schema._zod.run({
          value: payload.value[def.property],
          issues: []
        }, {});
        if (result instanceof Promise) {
          return result.then((result2) => handleCheckPropertyResult(result2, payload, def.property));
        }
        handleCheckPropertyResult(result, payload, def.property);
        return;
      };
    });
    exports2.$ZodCheckMimeType = core.$constructor("$ZodCheckMimeType", (inst, def) => {
      exports2.$ZodCheck.init(inst, def);
      const mimeSet = new Set(def.mime);
      inst._zod.onattach.push((inst2) => {
        inst2._zod.bag.mime = def.mime;
      });
      inst._zod.check = (payload) => {
        if (mimeSet.has(payload.value.type))
          return;
        payload.issues.push({
          code: "invalid_value",
          values: def.mime,
          input: payload.value.type,
          inst,
          continue: !def.abort
        });
      };
    });
    exports2.$ZodCheckOverwrite = core.$constructor("$ZodCheckOverwrite", (inst, def) => {
      exports2.$ZodCheck.init(inst, def);
      inst._zod.check = (payload) => {
        payload.value = def.tx(payload.value);
      };
    });
  }
});

// node_modules/zod/v4/core/doc.cjs
var require_doc = __commonJS({
  "node_modules/zod/v4/core/doc.cjs"(exports2) {
    "use strict";
    Object.defineProperty(exports2, "__esModule", { value: true });
    exports2.Doc = void 0;
    var Doc = class {
      static {
        __name(this, "Doc");
      }
      constructor(args = []) {
        this.content = [];
        this.indent = 0;
        if (this)
          this.args = args;
      }
      indented(fn) {
        this.indent += 1;
        fn(this);
        this.indent -= 1;
      }
      write(arg) {
        if (typeof arg === "function") {
          arg(this, { execution: "sync" });
          arg(this, { execution: "async" });
          return;
        }
        const content = arg;
        const lines = content.split("\n").filter((x) => x);
        const minIndent = Math.min(...lines.map((x) => x.length - x.trimStart().length));
        const dedented = lines.map((x) => x.slice(minIndent)).map((x) => " ".repeat(this.indent * 2) + x);
        for (const line of dedented) {
          this.content.push(line);
        }
      }
      compile() {
        const F = Function;
        const args = this?.args;
        const content = this?.content ?? [``];
        const lines = [...content.map((x) => `  ${x}`)];
        return new F(...args, lines.join("\n"));
      }
    };
    exports2.Doc = Doc;
  }
});

// node_modules/zod/v4/core/versions.cjs
var require_versions = __commonJS({
  "node_modules/zod/v4/core/versions.cjs"(exports2) {
    "use strict";
    Object.defineProperty(exports2, "__esModule", { value: true });
    exports2.version = void 0;
    exports2.version = {
      major: 4,
      minor: 3,
      patch: 6
    };
  }
});

// node_modules/zod/v4/core/schemas.cjs
var require_schemas = __commonJS({
  "node_modules/zod/v4/core/schemas.cjs"(exports2) {
    "use strict";
    var __createBinding = exports2 && exports2.__createBinding || (Object.create ? (function(o, m, k, k2) {
      if (k2 === void 0) k2 = k;
      var desc = Object.getOwnPropertyDescriptor(m, k);
      if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
        desc = { enumerable: true, get: /* @__PURE__ */ __name(function() {
          return m[k];
        }, "get") };
      }
      Object.defineProperty(o, k2, desc);
    }) : (function(o, m, k, k2) {
      if (k2 === void 0) k2 = k;
      o[k2] = m[k];
    }));
    var __setModuleDefault = exports2 && exports2.__setModuleDefault || (Object.create ? (function(o, v) {
      Object.defineProperty(o, "default", { enumerable: true, value: v });
    }) : function(o, v) {
      o["default"] = v;
    });
    var __importStar = exports2 && exports2.__importStar || function(mod) {
      if (mod && mod.__esModule) return mod;
      var result = {};
      if (mod != null) {
        for (var k in mod) if (k !== "default" && Object.prototype.hasOwnProperty.call(mod, k)) __createBinding(result, mod, k);
      }
      __setModuleDefault(result, mod);
      return result;
    };
    Object.defineProperty(exports2, "__esModule", { value: true });
    exports2.$ZodTuple = exports2.$ZodIntersection = exports2.$ZodDiscriminatedUnion = exports2.$ZodXor = exports2.$ZodUnion = exports2.$ZodObjectJIT = exports2.$ZodObject = exports2.$ZodArray = exports2.$ZodDate = exports2.$ZodVoid = exports2.$ZodNever = exports2.$ZodUnknown = exports2.$ZodAny = exports2.$ZodNull = exports2.$ZodUndefined = exports2.$ZodSymbol = exports2.$ZodBigIntFormat = exports2.$ZodBigInt = exports2.$ZodBoolean = exports2.$ZodNumberFormat = exports2.$ZodNumber = exports2.$ZodCustomStringFormat = exports2.$ZodJWT = exports2.$ZodE164 = exports2.$ZodBase64URL = exports2.$ZodBase64 = exports2.$ZodCIDRv6 = exports2.$ZodCIDRv4 = exports2.$ZodMAC = exports2.$ZodIPv6 = exports2.$ZodIPv4 = exports2.$ZodISODuration = exports2.$ZodISOTime = exports2.$ZodISODate = exports2.$ZodISODateTime = exports2.$ZodKSUID = exports2.$ZodXID = exports2.$ZodULID = exports2.$ZodCUID2 = exports2.$ZodCUID = exports2.$ZodNanoID = exports2.$ZodEmoji = exports2.$ZodURL = exports2.$ZodEmail = exports2.$ZodUUID = exports2.$ZodGUID = exports2.$ZodStringFormat = exports2.$ZodString = exports2.clone = exports2.$ZodType = void 0;
    exports2.$ZodCustom = exports2.$ZodLazy = exports2.$ZodPromise = exports2.$ZodFunction = exports2.$ZodTemplateLiteral = exports2.$ZodReadonly = exports2.$ZodCodec = exports2.$ZodPipe = exports2.$ZodNaN = exports2.$ZodCatch = exports2.$ZodSuccess = exports2.$ZodNonOptional = exports2.$ZodPrefault = exports2.$ZodDefault = exports2.$ZodNullable = exports2.$ZodExactOptional = exports2.$ZodOptional = exports2.$ZodTransform = exports2.$ZodFile = exports2.$ZodLiteral = exports2.$ZodEnum = exports2.$ZodSet = exports2.$ZodMap = exports2.$ZodRecord = void 0;
    exports2.isValidBase64 = isValidBase64;
    exports2.isValidBase64URL = isValidBase64URL;
    exports2.isValidJWT = isValidJWT;
    var checks = __importStar(require_checks());
    var core = __importStar(require_core());
    var doc_js_1 = require_doc();
    var parse_js_1 = require_parse();
    var regexes = __importStar(require_regexes());
    var util = __importStar(require_util());
    var versions_js_1 = require_versions();
    exports2.$ZodType = core.$constructor("$ZodType", (inst, def) => {
      var _a;
      inst ?? (inst = {});
      inst._zod.def = def;
      inst._zod.bag = inst._zod.bag || {};
      inst._zod.version = versions_js_1.version;
      const checks2 = [...inst._zod.def.checks ?? []];
      if (inst._zod.traits.has("$ZodCheck")) {
        checks2.unshift(inst);
      }
      for (const ch of checks2) {
        for (const fn of ch._zod.onattach) {
          fn(inst);
        }
      }
      if (checks2.length === 0) {
        (_a = inst._zod).deferred ?? (_a.deferred = []);
        inst._zod.deferred?.push(() => {
          inst._zod.run = inst._zod.parse;
        });
      } else {
        const runChecks = /* @__PURE__ */ __name((payload, checks3, ctx) => {
          let isAborted = util.aborted(payload);
          let asyncResult;
          for (const ch of checks3) {
            if (ch._zod.def.when) {
              const shouldRun = ch._zod.def.when(payload);
              if (!shouldRun)
                continue;
            } else if (isAborted) {
              continue;
            }
            const currLen = payload.issues.length;
            const _ = ch._zod.check(payload);
            if (_ instanceof Promise && ctx?.async === false) {
              throw new core.$ZodAsyncError();
            }
            if (asyncResult || _ instanceof Promise) {
              asyncResult = (asyncResult ?? Promise.resolve()).then(async () => {
                await _;
                const nextLen = payload.issues.length;
                if (nextLen === currLen)
                  return;
                if (!isAborted)
                  isAborted = util.aborted(payload, currLen);
              });
            } else {
              const nextLen = payload.issues.length;
              if (nextLen === currLen)
                continue;
              if (!isAborted)
                isAborted = util.aborted(payload, currLen);
            }
          }
          if (asyncResult) {
            return asyncResult.then(() => {
              return payload;
            });
          }
          return payload;
        }, "runChecks");
        const handleCanaryResult = /* @__PURE__ */ __name((canary, payload, ctx) => {
          if (util.aborted(canary)) {
            canary.aborted = true;
            return canary;
          }
          const checkResult = runChecks(payload, checks2, ctx);
          if (checkResult instanceof Promise) {
            if (ctx.async === false)
              throw new core.$ZodAsyncError();
            return checkResult.then((checkResult2) => inst._zod.parse(checkResult2, ctx));
          }
          return inst._zod.parse(checkResult, ctx);
        }, "handleCanaryResult");
        inst._zod.run = (payload, ctx) => {
          if (ctx.skipChecks) {
            return inst._zod.parse(payload, ctx);
          }
          if (ctx.direction === "backward") {
            const canary = inst._zod.parse({ value: payload.value, issues: [] }, { ...ctx, skipChecks: true });
            if (canary instanceof Promise) {
              return canary.then((canary2) => {
                return handleCanaryResult(canary2, payload, ctx);
              });
            }
            return handleCanaryResult(canary, payload, ctx);
          }
          const result = inst._zod.parse(payload, ctx);
          if (result instanceof Promise) {
            if (ctx.async === false)
              throw new core.$ZodAsyncError();
            return result.then((result2) => runChecks(result2, checks2, ctx));
          }
          return runChecks(result, checks2, ctx);
        };
      }
      util.defineLazy(inst, "~standard", () => ({
        validate: /* @__PURE__ */ __name((value) => {
          try {
            const r = (0, parse_js_1.safeParse)(inst, value);
            return r.success ? { value: r.data } : { issues: r.error?.issues };
          } catch (_) {
            return (0, parse_js_1.safeParseAsync)(inst, value).then((r) => r.success ? { value: r.data } : { issues: r.error?.issues });
          }
        }, "validate"),
        vendor: "zod",
        version: 1
      }));
    });
    var util_js_1 = require_util();
    Object.defineProperty(exports2, "clone", { enumerable: true, get: /* @__PURE__ */ __name(function() {
      return util_js_1.clone;
    }, "get") });
    exports2.$ZodString = core.$constructor("$ZodString", (inst, def) => {
      exports2.$ZodType.init(inst, def);
      inst._zod.pattern = [...inst?._zod.bag?.patterns ?? []].pop() ?? regexes.string(inst._zod.bag);
      inst._zod.parse = (payload, _) => {
        if (def.coerce)
          try {
            payload.value = String(payload.value);
          } catch (_2) {
          }
        if (typeof payload.value === "string")
          return payload;
        payload.issues.push({
          expected: "string",
          code: "invalid_type",
          input: payload.value,
          inst
        });
        return payload;
      };
    });
    exports2.$ZodStringFormat = core.$constructor("$ZodStringFormat", (inst, def) => {
      checks.$ZodCheckStringFormat.init(inst, def);
      exports2.$ZodString.init(inst, def);
    });
    exports2.$ZodGUID = core.$constructor("$ZodGUID", (inst, def) => {
      def.pattern ?? (def.pattern = regexes.guid);
      exports2.$ZodStringFormat.init(inst, def);
    });
    exports2.$ZodUUID = core.$constructor("$ZodUUID", (inst, def) => {
      if (def.version) {
        const versionMap = {
          v1: 1,
          v2: 2,
          v3: 3,
          v4: 4,
          v5: 5,
          v6: 6,
          v7: 7,
          v8: 8
        };
        const v = versionMap[def.version];
        if (v === void 0)
          throw new Error(`Invalid UUID version: "${def.version}"`);
        def.pattern ?? (def.pattern = regexes.uuid(v));
      } else
        def.pattern ?? (def.pattern = regexes.uuid());
      exports2.$ZodStringFormat.init(inst, def);
    });
    exports2.$ZodEmail = core.$constructor("$ZodEmail", (inst, def) => {
      def.pattern ?? (def.pattern = regexes.email);
      exports2.$ZodStringFormat.init(inst, def);
    });
    exports2.$ZodURL = core.$constructor("$ZodURL", (inst, def) => {
      exports2.$ZodStringFormat.init(inst, def);
      inst._zod.check = (payload) => {
        try {
          const trimmed = payload.value.trim();
          const url = new URL(trimmed);
          if (def.hostname) {
            def.hostname.lastIndex = 0;
            if (!def.hostname.test(url.hostname)) {
              payload.issues.push({
                code: "invalid_format",
                format: "url",
                note: "Invalid hostname",
                pattern: def.hostname.source,
                input: payload.value,
                inst,
                continue: !def.abort
              });
            }
          }
          if (def.protocol) {
            def.protocol.lastIndex = 0;
            if (!def.protocol.test(url.protocol.endsWith(":") ? url.protocol.slice(0, -1) : url.protocol)) {
              payload.issues.push({
                code: "invalid_format",
                format: "url",
                note: "Invalid protocol",
                pattern: def.protocol.source,
                input: payload.value,
                inst,
                continue: !def.abort
              });
            }
          }
          if (def.normalize) {
            payload.value = url.href;
          } else {
            payload.value = trimmed;
          }
          return;
        } catch (_) {
          payload.issues.push({
            code: "invalid_format",
            format: "url",
            input: payload.value,
            inst,
            continue: !def.abort
          });
        }
      };
    });
    exports2.$ZodEmoji = core.$constructor("$ZodEmoji", (inst, def) => {
      def.pattern ?? (def.pattern = regexes.emoji());
      exports2.$ZodStringFormat.init(inst, def);
    });
    exports2.$ZodNanoID = core.$constructor("$ZodNanoID", (inst, def) => {
      def.pattern ?? (def.pattern = regexes.nanoid);
      exports2.$ZodStringFormat.init(inst, def);
    });
    exports2.$ZodCUID = core.$constructor("$ZodCUID", (inst, def) => {
      def.pattern ?? (def.pattern = regexes.cuid);
      exports2.$ZodStringFormat.init(inst, def);
    });
    exports2.$ZodCUID2 = core.$constructor("$ZodCUID2", (inst, def) => {
      def.pattern ?? (def.pattern = regexes.cuid2);
      exports2.$ZodStringFormat.init(inst, def);
    });
    exports2.$ZodULID = core.$constructor("$ZodULID", (inst, def) => {
      def.pattern ?? (def.pattern = regexes.ulid);
      exports2.$ZodStringFormat.init(inst, def);
    });
    exports2.$ZodXID = core.$constructor("$ZodXID", (inst, def) => {
      def.pattern ?? (def.pattern = regexes.xid);
      exports2.$ZodStringFormat.init(inst, def);
    });
    exports2.$ZodKSUID = core.$constructor("$ZodKSUID", (inst, def) => {
      def.pattern ?? (def.pattern = regexes.ksuid);
      exports2.$ZodStringFormat.init(inst, def);
    });
    exports2.$ZodISODateTime = core.$constructor("$ZodISODateTime", (inst, def) => {
      def.pattern ?? (def.pattern = regexes.datetime(def));
      exports2.$ZodStringFormat.init(inst, def);
    });
    exports2.$ZodISODate = core.$constructor("$ZodISODate", (inst, def) => {
      def.pattern ?? (def.pattern = regexes.date);
      exports2.$ZodStringFormat.init(inst, def);
    });
    exports2.$ZodISOTime = core.$constructor("$ZodISOTime", (inst, def) => {
      def.pattern ?? (def.pattern = regexes.time(def));
      exports2.$ZodStringFormat.init(inst, def);
    });
    exports2.$ZodISODuration = core.$constructor("$ZodISODuration", (inst, def) => {
      def.pattern ?? (def.pattern = regexes.duration);
      exports2.$ZodStringFormat.init(inst, def);
    });
    exports2.$ZodIPv4 = core.$constructor("$ZodIPv4", (inst, def) => {
      def.pattern ?? (def.pattern = regexes.ipv4);
      exports2.$ZodStringFormat.init(inst, def);
      inst._zod.bag.format = `ipv4`;
    });
    exports2.$ZodIPv6 = core.$constructor("$ZodIPv6", (inst, def) => {
      def.pattern ?? (def.pattern = regexes.ipv6);
      exports2.$ZodStringFormat.init(inst, def);
      inst._zod.bag.format = `ipv6`;
      inst._zod.check = (payload) => {
        try {
          new URL(`http://[${payload.value}]`);
        } catch {
          payload.issues.push({
            code: "invalid_format",
            format: "ipv6",
            input: payload.value,
            inst,
            continue: !def.abort
          });
        }
      };
    });
    exports2.$ZodMAC = core.$constructor("$ZodMAC", (inst, def) => {
      def.pattern ?? (def.pattern = regexes.mac(def.delimiter));
      exports2.$ZodStringFormat.init(inst, def);
      inst._zod.bag.format = `mac`;
    });
    exports2.$ZodCIDRv4 = core.$constructor("$ZodCIDRv4", (inst, def) => {
      def.pattern ?? (def.pattern = regexes.cidrv4);
      exports2.$ZodStringFormat.init(inst, def);
    });
    exports2.$ZodCIDRv6 = core.$constructor("$ZodCIDRv6", (inst, def) => {
      def.pattern ?? (def.pattern = regexes.cidrv6);
      exports2.$ZodStringFormat.init(inst, def);
      inst._zod.check = (payload) => {
        const parts = payload.value.split("/");
        try {
          if (parts.length !== 2)
            throw new Error();
          const [address, prefix] = parts;
          if (!prefix)
            throw new Error();
          const prefixNum = Number(prefix);
          if (`${prefixNum}` !== prefix)
            throw new Error();
          if (prefixNum < 0 || prefixNum > 128)
            throw new Error();
          new URL(`http://[${address}]`);
        } catch {
          payload.issues.push({
            code: "invalid_format",
            format: "cidrv6",
            input: payload.value,
            inst,
            continue: !def.abort
          });
        }
      };
    });
    function isValidBase64(data) {
      if (data === "")
        return true;
      if (data.length % 4 !== 0)
        return false;
      try {
        atob(data);
        return true;
      } catch {
        return false;
      }
    }
    __name(isValidBase64, "isValidBase64");
    exports2.$ZodBase64 = core.$constructor("$ZodBase64", (inst, def) => {
      def.pattern ?? (def.pattern = regexes.base64);
      exports2.$ZodStringFormat.init(inst, def);
      inst._zod.bag.contentEncoding = "base64";
      inst._zod.check = (payload) => {
        if (isValidBase64(payload.value))
          return;
        payload.issues.push({
          code: "invalid_format",
          format: "base64",
          input: payload.value,
          inst,
          continue: !def.abort
        });
      };
    });
    function isValidBase64URL(data) {
      if (!regexes.base64url.test(data))
        return false;
      const base64 = data.replace(/[-_]/g, (c) => c === "-" ? "+" : "/");
      const padded = base64.padEnd(Math.ceil(base64.length / 4) * 4, "=");
      return isValidBase64(padded);
    }
    __name(isValidBase64URL, "isValidBase64URL");
    exports2.$ZodBase64URL = core.$constructor("$ZodBase64URL", (inst, def) => {
      def.pattern ?? (def.pattern = regexes.base64url);
      exports2.$ZodStringFormat.init(inst, def);
      inst._zod.bag.contentEncoding = "base64url";
      inst._zod.check = (payload) => {
        if (isValidBase64URL(payload.value))
          return;
        payload.issues.push({
          code: "invalid_format",
          format: "base64url",
          input: payload.value,
          inst,
          continue: !def.abort
        });
      };
    });
    exports2.$ZodE164 = core.$constructor("$ZodE164", (inst, def) => {
      def.pattern ?? (def.pattern = regexes.e164);
      exports2.$ZodStringFormat.init(inst, def);
    });
    function isValidJWT(token, algorithm = null) {
      try {
        const tokensParts = token.split(".");
        if (tokensParts.length !== 3)
          return false;
        const [header] = tokensParts;
        if (!header)
          return false;
        const parsedHeader = JSON.parse(atob(header));
        if ("typ" in parsedHeader && parsedHeader?.typ !== "JWT")
          return false;
        if (!parsedHeader.alg)
          return false;
        if (algorithm && (!("alg" in parsedHeader) || parsedHeader.alg !== algorithm))
          return false;
        return true;
      } catch {
        return false;
      }
    }
    __name(isValidJWT, "isValidJWT");
    exports2.$ZodJWT = core.$constructor("$ZodJWT", (inst, def) => {
      exports2.$ZodStringFormat.init(inst, def);
      inst._zod.check = (payload) => {
        if (isValidJWT(payload.value, def.alg))
          return;
        payload.issues.push({
          code: "invalid_format",
          format: "jwt",
          input: payload.value,
          inst,
          continue: !def.abort
        });
      };
    });
    exports2.$ZodCustomStringFormat = core.$constructor("$ZodCustomStringFormat", (inst, def) => {
      exports2.$ZodStringFormat.init(inst, def);
      inst._zod.check = (payload) => {
        if (def.fn(payload.value))
          return;
        payload.issues.push({
          code: "invalid_format",
          format: def.format,
          input: payload.value,
          inst,
          continue: !def.abort
        });
      };
    });
    exports2.$ZodNumber = core.$constructor("$ZodNumber", (inst, def) => {
      exports2.$ZodType.init(inst, def);
      inst._zod.pattern = inst._zod.bag.pattern ?? regexes.number;
      inst._zod.parse = (payload, _ctx) => {
        if (def.coerce)
          try {
            payload.value = Number(payload.value);
          } catch (_) {
          }
        const input = payload.value;
        if (typeof input === "number" && !Number.isNaN(input) && Number.isFinite(input)) {
          return payload;
        }
        const received = typeof input === "number" ? Number.isNaN(input) ? "NaN" : !Number.isFinite(input) ? "Infinity" : void 0 : void 0;
        payload.issues.push({
          expected: "number",
          code: "invalid_type",
          input,
          inst,
          ...received ? { received } : {}
        });
        return payload;
      };
    });
    exports2.$ZodNumberFormat = core.$constructor("$ZodNumberFormat", (inst, def) => {
      checks.$ZodCheckNumberFormat.init(inst, def);
      exports2.$ZodNumber.init(inst, def);
    });
    exports2.$ZodBoolean = core.$constructor("$ZodBoolean", (inst, def) => {
      exports2.$ZodType.init(inst, def);
      inst._zod.pattern = regexes.boolean;
      inst._zod.parse = (payload, _ctx) => {
        if (def.coerce)
          try {
            payload.value = Boolean(payload.value);
          } catch (_) {
          }
        const input = payload.value;
        if (typeof input === "boolean")
          return payload;
        payload.issues.push({
          expected: "boolean",
          code: "invalid_type",
          input,
          inst
        });
        return payload;
      };
    });
    exports2.$ZodBigInt = core.$constructor("$ZodBigInt", (inst, def) => {
      exports2.$ZodType.init(inst, def);
      inst._zod.pattern = regexes.bigint;
      inst._zod.parse = (payload, _ctx) => {
        if (def.coerce)
          try {
            payload.value = BigInt(payload.value);
          } catch (_) {
          }
        if (typeof payload.value === "bigint")
          return payload;
        payload.issues.push({
          expected: "bigint",
          code: "invalid_type",
          input: payload.value,
          inst
        });
        return payload;
      };
    });
    exports2.$ZodBigIntFormat = core.$constructor("$ZodBigIntFormat", (inst, def) => {
      checks.$ZodCheckBigIntFormat.init(inst, def);
      exports2.$ZodBigInt.init(inst, def);
    });
    exports2.$ZodSymbol = core.$constructor("$ZodSymbol", (inst, def) => {
      exports2.$ZodType.init(inst, def);
      inst._zod.parse = (payload, _ctx) => {
        const input = payload.value;
        if (typeof input === "symbol")
          return payload;
        payload.issues.push({
          expected: "symbol",
          code: "invalid_type",
          input,
          inst
        });
        return payload;
      };
    });
    exports2.$ZodUndefined = core.$constructor("$ZodUndefined", (inst, def) => {
      exports2.$ZodType.init(inst, def);
      inst._zod.pattern = regexes.undefined;
      inst._zod.values = /* @__PURE__ */ new Set([void 0]);
      inst._zod.optin = "optional";
      inst._zod.optout = "optional";
      inst._zod.parse = (payload, _ctx) => {
        const input = payload.value;
        if (typeof input === "undefined")
          return payload;
        payload.issues.push({
          expected: "undefined",
          code: "invalid_type",
          input,
          inst
        });
        return payload;
      };
    });
    exports2.$ZodNull = core.$constructor("$ZodNull", (inst, def) => {
      exports2.$ZodType.init(inst, def);
      inst._zod.pattern = regexes.null;
      inst._zod.values = /* @__PURE__ */ new Set([null]);
      inst._zod.parse = (payload, _ctx) => {
        const input = payload.value;
        if (input === null)
          return payload;
        payload.issues.push({
          expected: "null",
          code: "invalid_type",
          input,
          inst
        });
        return payload;
      };
    });
    exports2.$ZodAny = core.$constructor("$ZodAny", (inst, def) => {
      exports2.$ZodType.init(inst, def);
      inst._zod.parse = (payload) => payload;
    });
    exports2.$ZodUnknown = core.$constructor("$ZodUnknown", (inst, def) => {
      exports2.$ZodType.init(inst, def);
      inst._zod.parse = (payload) => payload;
    });
    exports2.$ZodNever = core.$constructor("$ZodNever", (inst, def) => {
      exports2.$ZodType.init(inst, def);
      inst._zod.parse = (payload, _ctx) => {
        payload.issues.push({
          expected: "never",
          code: "invalid_type",
          input: payload.value,
          inst
        });
        return payload;
      };
    });
    exports2.$ZodVoid = core.$constructor("$ZodVoid", (inst, def) => {
      exports2.$ZodType.init(inst, def);
      inst._zod.parse = (payload, _ctx) => {
        const input = payload.value;
        if (typeof input === "undefined")
          return payload;
        payload.issues.push({
          expected: "void",
          code: "invalid_type",
          input,
          inst
        });
        return payload;
      };
    });
    exports2.$ZodDate = core.$constructor("$ZodDate", (inst, def) => {
      exports2.$ZodType.init(inst, def);
      inst._zod.parse = (payload, _ctx) => {
        if (def.coerce) {
          try {
            payload.value = new Date(payload.value);
          } catch (_err) {
          }
        }
        const input = payload.value;
        const isDate = input instanceof Date;
        const isValidDate = isDate && !Number.isNaN(input.getTime());
        if (isValidDate)
          return payload;
        payload.issues.push({
          expected: "date",
          code: "invalid_type",
          input,
          ...isDate ? { received: "Invalid Date" } : {},
          inst
        });
        return payload;
      };
    });
    function handleArrayResult(result, final, index) {
      if (result.issues.length) {
        final.issues.push(...util.prefixIssues(index, result.issues));
      }
      final.value[index] = result.value;
    }
    __name(handleArrayResult, "handleArrayResult");
    exports2.$ZodArray = core.$constructor("$ZodArray", (inst, def) => {
      exports2.$ZodType.init(inst, def);
      inst._zod.parse = (payload, ctx) => {
        const input = payload.value;
        if (!Array.isArray(input)) {
          payload.issues.push({
            expected: "array",
            code: "invalid_type",
            input,
            inst
          });
          return payload;
        }
        payload.value = Array(input.length);
        const proms = [];
        for (let i = 0; i < input.length; i++) {
          const item = input[i];
          const result = def.element._zod.run({
            value: item,
            issues: []
          }, ctx);
          if (result instanceof Promise) {
            proms.push(result.then((result2) => handleArrayResult(result2, payload, i)));
          } else {
            handleArrayResult(result, payload, i);
          }
        }
        if (proms.length) {
          return Promise.all(proms).then(() => payload);
        }
        return payload;
      };
    });
    function handlePropertyResult(result, final, key, input, isOptionalOut) {
      if (result.issues.length) {
        if (isOptionalOut && !(key in input)) {
          return;
        }
        final.issues.push(...util.prefixIssues(key, result.issues));
      }
      if (result.value === void 0) {
        if (key in input) {
          final.value[key] = void 0;
        }
      } else {
        final.value[key] = result.value;
      }
    }
    __name(handlePropertyResult, "handlePropertyResult");
    function normalizeDef(def) {
      const keys = Object.keys(def.shape);
      for (const k of keys) {
        if (!def.shape?.[k]?._zod?.traits?.has("$ZodType")) {
          throw new Error(`Invalid element at key "${k}": expected a Zod schema`);
        }
      }
      const okeys = util.optionalKeys(def.shape);
      return {
        ...def,
        keys,
        keySet: new Set(keys),
        numKeys: keys.length,
        optionalKeys: new Set(okeys)
      };
    }
    __name(normalizeDef, "normalizeDef");
    function handleCatchall(proms, input, payload, ctx, def, inst) {
      const unrecognized = [];
      const keySet = def.keySet;
      const _catchall = def.catchall._zod;
      const t = _catchall.def.type;
      const isOptionalOut = _catchall.optout === "optional";
      for (const key in input) {
        if (keySet.has(key))
          continue;
        if (t === "never") {
          unrecognized.push(key);
          continue;
        }
        const r = _catchall.run({ value: input[key], issues: [] }, ctx);
        if (r instanceof Promise) {
          proms.push(r.then((r2) => handlePropertyResult(r2, payload, key, input, isOptionalOut)));
        } else {
          handlePropertyResult(r, payload, key, input, isOptionalOut);
        }
      }
      if (unrecognized.length) {
        payload.issues.push({
          code: "unrecognized_keys",
          keys: unrecognized,
          input,
          inst
        });
      }
      if (!proms.length)
        return payload;
      return Promise.all(proms).then(() => {
        return payload;
      });
    }
    __name(handleCatchall, "handleCatchall");
    exports2.$ZodObject = core.$constructor("$ZodObject", (inst, def) => {
      exports2.$ZodType.init(inst, def);
      const desc = Object.getOwnPropertyDescriptor(def, "shape");
      if (!desc?.get) {
        const sh = def.shape;
        Object.defineProperty(def, "shape", {
          get: /* @__PURE__ */ __name(() => {
            const newSh = { ...sh };
            Object.defineProperty(def, "shape", {
              value: newSh
            });
            return newSh;
          }, "get")
        });
      }
      const _normalized = util.cached(() => normalizeDef(def));
      util.defineLazy(inst._zod, "propValues", () => {
        const shape = def.shape;
        const propValues = {};
        for (const key in shape) {
          const field = shape[key]._zod;
          if (field.values) {
            propValues[key] ?? (propValues[key] = /* @__PURE__ */ new Set());
            for (const v of field.values)
              propValues[key].add(v);
          }
        }
        return propValues;
      });
      const isObject = util.isObject;
      const catchall = def.catchall;
      let value;
      inst._zod.parse = (payload, ctx) => {
        value ?? (value = _normalized.value);
        const input = payload.value;
        if (!isObject(input)) {
          payload.issues.push({
            expected: "object",
            code: "invalid_type",
            input,
            inst
          });
          return payload;
        }
        payload.value = {};
        const proms = [];
        const shape = value.shape;
        for (const key of value.keys) {
          const el = shape[key];
          const isOptionalOut = el._zod.optout === "optional";
          const r = el._zod.run({ value: input[key], issues: [] }, ctx);
          if (r instanceof Promise) {
            proms.push(r.then((r2) => handlePropertyResult(r2, payload, key, input, isOptionalOut)));
          } else {
            handlePropertyResult(r, payload, key, input, isOptionalOut);
          }
        }
        if (!catchall) {
          return proms.length ? Promise.all(proms).then(() => payload) : payload;
        }
        return handleCatchall(proms, input, payload, ctx, _normalized.value, inst);
      };
    });
    exports2.$ZodObjectJIT = core.$constructor("$ZodObjectJIT", (inst, def) => {
      exports2.$ZodObject.init(inst, def);
      const superParse = inst._zod.parse;
      const _normalized = util.cached(() => normalizeDef(def));
      const generateFastpass = /* @__PURE__ */ __name((shape) => {
        const doc = new doc_js_1.Doc(["shape", "payload", "ctx"]);
        const normalized = _normalized.value;
        const parseStr = /* @__PURE__ */ __name((key) => {
          const k = util.esc(key);
          return `shape[${k}]._zod.run({ value: input[${k}], issues: [] }, ctx)`;
        }, "parseStr");
        doc.write(`const input = payload.value;`);
        const ids = /* @__PURE__ */ Object.create(null);
        let counter = 0;
        for (const key of normalized.keys) {
          ids[key] = `key_${counter++}`;
        }
        doc.write(`const newResult = {};`);
        for (const key of normalized.keys) {
          const id = ids[key];
          const k = util.esc(key);
          const schema = shape[key];
          const isOptionalOut = schema?._zod?.optout === "optional";
          doc.write(`const ${id} = ${parseStr(key)};`);
          if (isOptionalOut) {
            doc.write(`
        if (${id}.issues.length) {
          if (${k} in input) {
            payload.issues = payload.issues.concat(${id}.issues.map(iss => ({
              ...iss,
              path: iss.path ? [${k}, ...iss.path] : [${k}]
            })));
          }
        }
        
        if (${id}.value === undefined) {
          if (${k} in input) {
            newResult[${k}] = undefined;
          }
        } else {
          newResult[${k}] = ${id}.value;
        }
        
      `);
          } else {
            doc.write(`
        if (${id}.issues.length) {
          payload.issues = payload.issues.concat(${id}.issues.map(iss => ({
            ...iss,
            path: iss.path ? [${k}, ...iss.path] : [${k}]
          })));
        }
        
        if (${id}.value === undefined) {
          if (${k} in input) {
            newResult[${k}] = undefined;
          }
        } else {
          newResult[${k}] = ${id}.value;
        }
        
      `);
          }
        }
        doc.write(`payload.value = newResult;`);
        doc.write(`return payload;`);
        const fn = doc.compile();
        return (payload, ctx) => fn(shape, payload, ctx);
      }, "generateFastpass");
      let fastpass;
      const isObject = util.isObject;
      const jit = !core.globalConfig.jitless;
      const allowsEval = util.allowsEval;
      const fastEnabled = jit && allowsEval.value;
      const catchall = def.catchall;
      let value;
      inst._zod.parse = (payload, ctx) => {
        value ?? (value = _normalized.value);
        const input = payload.value;
        if (!isObject(input)) {
          payload.issues.push({
            expected: "object",
            code: "invalid_type",
            input,
            inst
          });
          return payload;
        }
        if (jit && fastEnabled && ctx?.async === false && ctx.jitless !== true) {
          if (!fastpass)
            fastpass = generateFastpass(def.shape);
          payload = fastpass(payload, ctx);
          if (!catchall)
            return payload;
          return handleCatchall([], input, payload, ctx, value, inst);
        }
        return superParse(payload, ctx);
      };
    });
    function handleUnionResults(results, final, inst, ctx) {
      for (const result of results) {
        if (result.issues.length === 0) {
          final.value = result.value;
          return final;
        }
      }
      const nonaborted = results.filter((r) => !util.aborted(r));
      if (nonaborted.length === 1) {
        final.value = nonaborted[0].value;
        return nonaborted[0];
      }
      final.issues.push({
        code: "invalid_union",
        input: final.value,
        inst,
        errors: results.map((result) => result.issues.map((iss) => util.finalizeIssue(iss, ctx, core.config())))
      });
      return final;
    }
    __name(handleUnionResults, "handleUnionResults");
    exports2.$ZodUnion = core.$constructor("$ZodUnion", (inst, def) => {
      exports2.$ZodType.init(inst, def);
      util.defineLazy(inst._zod, "optin", () => def.options.some((o) => o._zod.optin === "optional") ? "optional" : void 0);
      util.defineLazy(inst._zod, "optout", () => def.options.some((o) => o._zod.optout === "optional") ? "optional" : void 0);
      util.defineLazy(inst._zod, "values", () => {
        if (def.options.every((o) => o._zod.values)) {
          return new Set(def.options.flatMap((option) => Array.from(option._zod.values)));
        }
        return void 0;
      });
      util.defineLazy(inst._zod, "pattern", () => {
        if (def.options.every((o) => o._zod.pattern)) {
          const patterns = def.options.map((o) => o._zod.pattern);
          return new RegExp(`^(${patterns.map((p) => util.cleanRegex(p.source)).join("|")})$`);
        }
        return void 0;
      });
      const single = def.options.length === 1;
      const first = def.options[0]._zod.run;
      inst._zod.parse = (payload, ctx) => {
        if (single) {
          return first(payload, ctx);
        }
        let async = false;
        const results = [];
        for (const option of def.options) {
          const result = option._zod.run({
            value: payload.value,
            issues: []
          }, ctx);
          if (result instanceof Promise) {
            results.push(result);
            async = true;
          } else {
            if (result.issues.length === 0)
              return result;
            results.push(result);
          }
        }
        if (!async)
          return handleUnionResults(results, payload, inst, ctx);
        return Promise.all(results).then((results2) => {
          return handleUnionResults(results2, payload, inst, ctx);
        });
      };
    });
    function handleExclusiveUnionResults(results, final, inst, ctx) {
      const successes = results.filter((r) => r.issues.length === 0);
      if (successes.length === 1) {
        final.value = successes[0].value;
        return final;
      }
      if (successes.length === 0) {
        final.issues.push({
          code: "invalid_union",
          input: final.value,
          inst,
          errors: results.map((result) => result.issues.map((iss) => util.finalizeIssue(iss, ctx, core.config())))
        });
      } else {
        final.issues.push({
          code: "invalid_union",
          input: final.value,
          inst,
          errors: [],
          inclusive: false
        });
      }
      return final;
    }
    __name(handleExclusiveUnionResults, "handleExclusiveUnionResults");
    exports2.$ZodXor = core.$constructor("$ZodXor", (inst, def) => {
      exports2.$ZodUnion.init(inst, def);
      def.inclusive = false;
      const single = def.options.length === 1;
      const first = def.options[0]._zod.run;
      inst._zod.parse = (payload, ctx) => {
        if (single) {
          return first(payload, ctx);
        }
        let async = false;
        const results = [];
        for (const option of def.options) {
          const result = option._zod.run({
            value: payload.value,
            issues: []
          }, ctx);
          if (result instanceof Promise) {
            results.push(result);
            async = true;
          } else {
            results.push(result);
          }
        }
        if (!async)
          return handleExclusiveUnionResults(results, payload, inst, ctx);
        return Promise.all(results).then((results2) => {
          return handleExclusiveUnionResults(results2, payload, inst, ctx);
        });
      };
    });
    exports2.$ZodDiscriminatedUnion = /* @__PURE__ */ core.$constructor("$ZodDiscriminatedUnion", (inst, def) => {
      def.inclusive = false;
      exports2.$ZodUnion.init(inst, def);
      const _super = inst._zod.parse;
      util.defineLazy(inst._zod, "propValues", () => {
        const propValues = {};
        for (const option of def.options) {
          const pv = option._zod.propValues;
          if (!pv || Object.keys(pv).length === 0)
            throw new Error(`Invalid discriminated union option at index "${def.options.indexOf(option)}"`);
          for (const [k, v] of Object.entries(pv)) {
            if (!propValues[k])
              propValues[k] = /* @__PURE__ */ new Set();
            for (const val of v) {
              propValues[k].add(val);
            }
          }
        }
        return propValues;
      });
      const disc = util.cached(() => {
        const opts = def.options;
        const map = /* @__PURE__ */ new Map();
        for (const o of opts) {
          const values = o._zod.propValues?.[def.discriminator];
          if (!values || values.size === 0)
            throw new Error(`Invalid discriminated union option at index "${def.options.indexOf(o)}"`);
          for (const v of values) {
            if (map.has(v)) {
              throw new Error(`Duplicate discriminator value "${String(v)}"`);
            }
            map.set(v, o);
          }
        }
        return map;
      });
      inst._zod.parse = (payload, ctx) => {
        const input = payload.value;
        if (!util.isObject(input)) {
          payload.issues.push({
            code: "invalid_type",
            expected: "object",
            input,
            inst
          });
          return payload;
        }
        const opt = disc.value.get(input?.[def.discriminator]);
        if (opt) {
          return opt._zod.run(payload, ctx);
        }
        if (def.unionFallback) {
          return _super(payload, ctx);
        }
        payload.issues.push({
          code: "invalid_union",
          errors: [],
          note: "No matching discriminator",
          discriminator: def.discriminator,
          input,
          path: [def.discriminator],
          inst
        });
        return payload;
      };
    });
    exports2.$ZodIntersection = core.$constructor("$ZodIntersection", (inst, def) => {
      exports2.$ZodType.init(inst, def);
      inst._zod.parse = (payload, ctx) => {
        const input = payload.value;
        const left = def.left._zod.run({ value: input, issues: [] }, ctx);
        const right = def.right._zod.run({ value: input, issues: [] }, ctx);
        const async = left instanceof Promise || right instanceof Promise;
        if (async) {
          return Promise.all([left, right]).then(([left2, right2]) => {
            return handleIntersectionResults(payload, left2, right2);
          });
        }
        return handleIntersectionResults(payload, left, right);
      };
    });
    function mergeValues(a, b) {
      if (a === b) {
        return { valid: true, data: a };
      }
      if (a instanceof Date && b instanceof Date && +a === +b) {
        return { valid: true, data: a };
      }
      if (util.isPlainObject(a) && util.isPlainObject(b)) {
        const bKeys = Object.keys(b);
        const sharedKeys = Object.keys(a).filter((key) => bKeys.indexOf(key) !== -1);
        const newObj = { ...a, ...b };
        for (const key of sharedKeys) {
          const sharedValue = mergeValues(a[key], b[key]);
          if (!sharedValue.valid) {
            return {
              valid: false,
              mergeErrorPath: [key, ...sharedValue.mergeErrorPath]
            };
          }
          newObj[key] = sharedValue.data;
        }
        return { valid: true, data: newObj };
      }
      if (Array.isArray(a) && Array.isArray(b)) {
        if (a.length !== b.length) {
          return { valid: false, mergeErrorPath: [] };
        }
        const newArray = [];
        for (let index = 0; index < a.length; index++) {
          const itemA = a[index];
          const itemB = b[index];
          const sharedValue = mergeValues(itemA, itemB);
          if (!sharedValue.valid) {
            return {
              valid: false,
              mergeErrorPath: [index, ...sharedValue.mergeErrorPath]
            };
          }
          newArray.push(sharedValue.data);
        }
        return { valid: true, data: newArray };
      }
      return { valid: false, mergeErrorPath: [] };
    }
    __name(mergeValues, "mergeValues");
    function handleIntersectionResults(result, left, right) {
      const unrecKeys = /* @__PURE__ */ new Map();
      let unrecIssue;
      for (const iss of left.issues) {
        if (iss.code === "unrecognized_keys") {
          unrecIssue ?? (unrecIssue = iss);
          for (const k of iss.keys) {
            if (!unrecKeys.has(k))
              unrecKeys.set(k, {});
            unrecKeys.get(k).l = true;
          }
        } else {
          result.issues.push(iss);
        }
      }
      for (const iss of right.issues) {
        if (iss.code === "unrecognized_keys") {
          for (const k of iss.keys) {
            if (!unrecKeys.has(k))
              unrecKeys.set(k, {});
            unrecKeys.get(k).r = true;
          }
        } else {
          result.issues.push(iss);
        }
      }
      const bothKeys = [...unrecKeys].filter(([, f]) => f.l && f.r).map(([k]) => k);
      if (bothKeys.length && unrecIssue) {
        result.issues.push({ ...unrecIssue, keys: bothKeys });
      }
      if (util.aborted(result))
        return result;
      const merged = mergeValues(left.value, right.value);
      if (!merged.valid) {
        throw new Error(`Unmergable intersection. Error path: ${JSON.stringify(merged.mergeErrorPath)}`);
      }
      result.value = merged.data;
      return result;
    }
    __name(handleIntersectionResults, "handleIntersectionResults");
    exports2.$ZodTuple = core.$constructor("$ZodTuple", (inst, def) => {
      exports2.$ZodType.init(inst, def);
      const items = def.items;
      inst._zod.parse = (payload, ctx) => {
        const input = payload.value;
        if (!Array.isArray(input)) {
          payload.issues.push({
            input,
            inst,
            expected: "tuple",
            code: "invalid_type"
          });
          return payload;
        }
        payload.value = [];
        const proms = [];
        const reversedIndex = [...items].reverse().findIndex((item) => item._zod.optin !== "optional");
        const optStart = reversedIndex === -1 ? 0 : items.length - reversedIndex;
        if (!def.rest) {
          const tooBig = input.length > items.length;
          const tooSmall = input.length < optStart - 1;
          if (tooBig || tooSmall) {
            payload.issues.push({
              ...tooBig ? { code: "too_big", maximum: items.length, inclusive: true } : { code: "too_small", minimum: items.length },
              input,
              inst,
              origin: "array"
            });
            return payload;
          }
        }
        let i = -1;
        for (const item of items) {
          i++;
          if (i >= input.length) {
            if (i >= optStart)
              continue;
          }
          const result = item._zod.run({
            value: input[i],
            issues: []
          }, ctx);
          if (result instanceof Promise) {
            proms.push(result.then((result2) => handleTupleResult(result2, payload, i)));
          } else {
            handleTupleResult(result, payload, i);
          }
        }
        if (def.rest) {
          const rest = input.slice(items.length);
          for (const el of rest) {
            i++;
            const result = def.rest._zod.run({
              value: el,
              issues: []
            }, ctx);
            if (result instanceof Promise) {
              proms.push(result.then((result2) => handleTupleResult(result2, payload, i)));
            } else {
              handleTupleResult(result, payload, i);
            }
          }
        }
        if (proms.length)
          return Promise.all(proms).then(() => payload);
        return payload;
      };
    });
    function handleTupleResult(result, final, index) {
      if (result.issues.length) {
        final.issues.push(...util.prefixIssues(index, result.issues));
      }
      final.value[index] = result.value;
    }
    __name(handleTupleResult, "handleTupleResult");
    exports2.$ZodRecord = core.$constructor("$ZodRecord", (inst, def) => {
      exports2.$ZodType.init(inst, def);
      inst._zod.parse = (payload, ctx) => {
        const input = payload.value;
        if (!util.isPlainObject(input)) {
          payload.issues.push({
            expected: "record",
            code: "invalid_type",
            input,
            inst
          });
          return payload;
        }
        const proms = [];
        const values = def.keyType._zod.values;
        if (values) {
          payload.value = {};
          const recordKeys = /* @__PURE__ */ new Set();
          for (const key of values) {
            if (typeof key === "string" || typeof key === "number" || typeof key === "symbol") {
              recordKeys.add(typeof key === "number" ? key.toString() : key);
              const result = def.valueType._zod.run({ value: input[key], issues: [] }, ctx);
              if (result instanceof Promise) {
                proms.push(result.then((result2) => {
                  if (result2.issues.length) {
                    payload.issues.push(...util.prefixIssues(key, result2.issues));
                  }
                  payload.value[key] = result2.value;
                }));
              } else {
                if (result.issues.length) {
                  payload.issues.push(...util.prefixIssues(key, result.issues));
                }
                payload.value[key] = result.value;
              }
            }
          }
          let unrecognized;
          for (const key in input) {
            if (!recordKeys.has(key)) {
              unrecognized = unrecognized ?? [];
              unrecognized.push(key);
            }
          }
          if (unrecognized && unrecognized.length > 0) {
            payload.issues.push({
              code: "unrecognized_keys",
              input,
              inst,
              keys: unrecognized
            });
          }
        } else {
          payload.value = {};
          for (const key of Reflect.ownKeys(input)) {
            if (key === "__proto__")
              continue;
            let keyResult = def.keyType._zod.run({ value: key, issues: [] }, ctx);
            if (keyResult instanceof Promise) {
              throw new Error("Async schemas not supported in object keys currently");
            }
            const checkNumericKey = typeof key === "string" && regexes.number.test(key) && keyResult.issues.length;
            if (checkNumericKey) {
              const retryResult = def.keyType._zod.run({ value: Number(key), issues: [] }, ctx);
              if (retryResult instanceof Promise) {
                throw new Error("Async schemas not supported in object keys currently");
              }
              if (retryResult.issues.length === 0) {
                keyResult = retryResult;
              }
            }
            if (keyResult.issues.length) {
              if (def.mode === "loose") {
                payload.value[key] = input[key];
              } else {
                payload.issues.push({
                  code: "invalid_key",
                  origin: "record",
                  issues: keyResult.issues.map((iss) => util.finalizeIssue(iss, ctx, core.config())),
                  input: key,
                  path: [key],
                  inst
                });
              }
              continue;
            }
            const result = def.valueType._zod.run({ value: input[key], issues: [] }, ctx);
            if (result instanceof Promise) {
              proms.push(result.then((result2) => {
                if (result2.issues.length) {
                  payload.issues.push(...util.prefixIssues(key, result2.issues));
                }
                payload.value[keyResult.value] = result2.value;
              }));
            } else {
              if (result.issues.length) {
                payload.issues.push(...util.prefixIssues(key, result.issues));
              }
              payload.value[keyResult.value] = result.value;
            }
          }
        }
        if (proms.length) {
          return Promise.all(proms).then(() => payload);
        }
        return payload;
      };
    });
    exports2.$ZodMap = core.$constructor("$ZodMap", (inst, def) => {
      exports2.$ZodType.init(inst, def);
      inst._zod.parse = (payload, ctx) => {
        const input = payload.value;
        if (!(input instanceof Map)) {
          payload.issues.push({
            expected: "map",
            code: "invalid_type",
            input,
            inst
          });
          return payload;
        }
        const proms = [];
        payload.value = /* @__PURE__ */ new Map();
        for (const [key, value] of input) {
          const keyResult = def.keyType._zod.run({ value: key, issues: [] }, ctx);
          const valueResult = def.valueType._zod.run({ value, issues: [] }, ctx);
          if (keyResult instanceof Promise || valueResult instanceof Promise) {
            proms.push(Promise.all([keyResult, valueResult]).then(([keyResult2, valueResult2]) => {
              handleMapResult(keyResult2, valueResult2, payload, key, input, inst, ctx);
            }));
          } else {
            handleMapResult(keyResult, valueResult, payload, key, input, inst, ctx);
          }
        }
        if (proms.length)
          return Promise.all(proms).then(() => payload);
        return payload;
      };
    });
    function handleMapResult(keyResult, valueResult, final, key, input, inst, ctx) {
      if (keyResult.issues.length) {
        if (util.propertyKeyTypes.has(typeof key)) {
          final.issues.push(...util.prefixIssues(key, keyResult.issues));
        } else {
          final.issues.push({
            code: "invalid_key",
            origin: "map",
            input,
            inst,
            issues: keyResult.issues.map((iss) => util.finalizeIssue(iss, ctx, core.config()))
          });
        }
      }
      if (valueResult.issues.length) {
        if (util.propertyKeyTypes.has(typeof key)) {
          final.issues.push(...util.prefixIssues(key, valueResult.issues));
        } else {
          final.issues.push({
            origin: "map",
            code: "invalid_element",
            input,
            inst,
            key,
            issues: valueResult.issues.map((iss) => util.finalizeIssue(iss, ctx, core.config()))
          });
        }
      }
      final.value.set(keyResult.value, valueResult.value);
    }
    __name(handleMapResult, "handleMapResult");
    exports2.$ZodSet = core.$constructor("$ZodSet", (inst, def) => {
      exports2.$ZodType.init(inst, def);
      inst._zod.parse = (payload, ctx) => {
        const input = payload.value;
        if (!(input instanceof Set)) {
          payload.issues.push({
            input,
            inst,
            expected: "set",
            code: "invalid_type"
          });
          return payload;
        }
        const proms = [];
        payload.value = /* @__PURE__ */ new Set();
        for (const item of input) {
          const result = def.valueType._zod.run({ value: item, issues: [] }, ctx);
          if (result instanceof Promise) {
            proms.push(result.then((result2) => handleSetResult(result2, payload)));
          } else
            handleSetResult(result, payload);
        }
        if (proms.length)
          return Promise.all(proms).then(() => payload);
        return payload;
      };
    });
    function handleSetResult(result, final) {
      if (result.issues.length) {
        final.issues.push(...result.issues);
      }
      final.value.add(result.value);
    }
    __name(handleSetResult, "handleSetResult");
    exports2.$ZodEnum = core.$constructor("$ZodEnum", (inst, def) => {
      exports2.$ZodType.init(inst, def);
      const values = util.getEnumValues(def.entries);
      const valuesSet = new Set(values);
      inst._zod.values = valuesSet;
      inst._zod.pattern = new RegExp(`^(${values.filter((k) => util.propertyKeyTypes.has(typeof k)).map((o) => typeof o === "string" ? util.escapeRegex(o) : o.toString()).join("|")})$`);
      inst._zod.parse = (payload, _ctx) => {
        const input = payload.value;
        if (valuesSet.has(input)) {
          return payload;
        }
        payload.issues.push({
          code: "invalid_value",
          values,
          input,
          inst
        });
        return payload;
      };
    });
    exports2.$ZodLiteral = core.$constructor("$ZodLiteral", (inst, def) => {
      exports2.$ZodType.init(inst, def);
      if (def.values.length === 0) {
        throw new Error("Cannot create literal schema with no valid values");
      }
      const values = new Set(def.values);
      inst._zod.values = values;
      inst._zod.pattern = new RegExp(`^(${def.values.map((o) => typeof o === "string" ? util.escapeRegex(o) : o ? util.escapeRegex(o.toString()) : String(o)).join("|")})$`);
      inst._zod.parse = (payload, _ctx) => {
        const input = payload.value;
        if (values.has(input)) {
          return payload;
        }
        payload.issues.push({
          code: "invalid_value",
          values: def.values,
          input,
          inst
        });
        return payload;
      };
    });
    exports2.$ZodFile = core.$constructor("$ZodFile", (inst, def) => {
      exports2.$ZodType.init(inst, def);
      inst._zod.parse = (payload, _ctx) => {
        const input = payload.value;
        if (input instanceof File)
          return payload;
        payload.issues.push({
          expected: "file",
          code: "invalid_type",
          input,
          inst
        });
        return payload;
      };
    });
    exports2.$ZodTransform = core.$constructor("$ZodTransform", (inst, def) => {
      exports2.$ZodType.init(inst, def);
      inst._zod.parse = (payload, ctx) => {
        if (ctx.direction === "backward") {
          throw new core.$ZodEncodeError(inst.constructor.name);
        }
        const _out = def.transform(payload.value, payload);
        if (ctx.async) {
          const output = _out instanceof Promise ? _out : Promise.resolve(_out);
          return output.then((output2) => {
            payload.value = output2;
            return payload;
          });
        }
        if (_out instanceof Promise) {
          throw new core.$ZodAsyncError();
        }
        payload.value = _out;
        return payload;
      };
    });
    function handleOptionalResult(result, input) {
      if (result.issues.length && input === void 0) {
        return { issues: [], value: void 0 };
      }
      return result;
    }
    __name(handleOptionalResult, "handleOptionalResult");
    exports2.$ZodOptional = core.$constructor("$ZodOptional", (inst, def) => {
      exports2.$ZodType.init(inst, def);
      inst._zod.optin = "optional";
      inst._zod.optout = "optional";
      util.defineLazy(inst._zod, "values", () => {
        return def.innerType._zod.values ? /* @__PURE__ */ new Set([...def.innerType._zod.values, void 0]) : void 0;
      });
      util.defineLazy(inst._zod, "pattern", () => {
        const pattern = def.innerType._zod.pattern;
        return pattern ? new RegExp(`^(${util.cleanRegex(pattern.source)})?$`) : void 0;
      });
      inst._zod.parse = (payload, ctx) => {
        if (def.innerType._zod.optin === "optional") {
          const result = def.innerType._zod.run(payload, ctx);
          if (result instanceof Promise)
            return result.then((r) => handleOptionalResult(r, payload.value));
          return handleOptionalResult(result, payload.value);
        }
        if (payload.value === void 0) {
          return payload;
        }
        return def.innerType._zod.run(payload, ctx);
      };
    });
    exports2.$ZodExactOptional = core.$constructor("$ZodExactOptional", (inst, def) => {
      exports2.$ZodOptional.init(inst, def);
      util.defineLazy(inst._zod, "values", () => def.innerType._zod.values);
      util.defineLazy(inst._zod, "pattern", () => def.innerType._zod.pattern);
      inst._zod.parse = (payload, ctx) => {
        return def.innerType._zod.run(payload, ctx);
      };
    });
    exports2.$ZodNullable = core.$constructor("$ZodNullable", (inst, def) => {
      exports2.$ZodType.init(inst, def);
      util.defineLazy(inst._zod, "optin", () => def.innerType._zod.optin);
      util.defineLazy(inst._zod, "optout", () => def.innerType._zod.optout);
      util.defineLazy(inst._zod, "pattern", () => {
        const pattern = def.innerType._zod.pattern;
        return pattern ? new RegExp(`^(${util.cleanRegex(pattern.source)}|null)$`) : void 0;
      });
      util.defineLazy(inst._zod, "values", () => {
        return def.innerType._zod.values ? /* @__PURE__ */ new Set([...def.innerType._zod.values, null]) : void 0;
      });
      inst._zod.parse = (payload, ctx) => {
        if (payload.value === null)
          return payload;
        return def.innerType._zod.run(payload, ctx);
      };
    });
    exports2.$ZodDefault = core.$constructor("$ZodDefault", (inst, def) => {
      exports2.$ZodType.init(inst, def);
      inst._zod.optin = "optional";
      util.defineLazy(inst._zod, "values", () => def.innerType._zod.values);
      inst._zod.parse = (payload, ctx) => {
        if (ctx.direction === "backward") {
          return def.innerType._zod.run(payload, ctx);
        }
        if (payload.value === void 0) {
          payload.value = def.defaultValue;
          return payload;
        }
        const result = def.innerType._zod.run(payload, ctx);
        if (result instanceof Promise) {
          return result.then((result2) => handleDefaultResult(result2, def));
        }
        return handleDefaultResult(result, def);
      };
    });
    function handleDefaultResult(payload, def) {
      if (payload.value === void 0) {
        payload.value = def.defaultValue;
      }
      return payload;
    }
    __name(handleDefaultResult, "handleDefaultResult");
    exports2.$ZodPrefault = core.$constructor("$ZodPrefault", (inst, def) => {
      exports2.$ZodType.init(inst, def);
      inst._zod.optin = "optional";
      util.defineLazy(inst._zod, "values", () => def.innerType._zod.values);
      inst._zod.parse = (payload, ctx) => {
        if (ctx.direction === "backward") {
          return def.innerType._zod.run(payload, ctx);
        }
        if (payload.value === void 0) {
          payload.value = def.defaultValue;
        }
        return def.innerType._zod.run(payload, ctx);
      };
    });
    exports2.$ZodNonOptional = core.$constructor("$ZodNonOptional", (inst, def) => {
      exports2.$ZodType.init(inst, def);
      util.defineLazy(inst._zod, "values", () => {
        const v = def.innerType._zod.values;
        return v ? new Set([...v].filter((x) => x !== void 0)) : void 0;
      });
      inst._zod.parse = (payload, ctx) => {
        const result = def.innerType._zod.run(payload, ctx);
        if (result instanceof Promise) {
          return result.then((result2) => handleNonOptionalResult(result2, inst));
        }
        return handleNonOptionalResult(result, inst);
      };
    });
    function handleNonOptionalResult(payload, inst) {
      if (!payload.issues.length && payload.value === void 0) {
        payload.issues.push({
          code: "invalid_type",
          expected: "nonoptional",
          input: payload.value,
          inst
        });
      }
      return payload;
    }
    __name(handleNonOptionalResult, "handleNonOptionalResult");
    exports2.$ZodSuccess = core.$constructor("$ZodSuccess", (inst, def) => {
      exports2.$ZodType.init(inst, def);
      inst._zod.parse = (payload, ctx) => {
        if (ctx.direction === "backward") {
          throw new core.$ZodEncodeError("ZodSuccess");
        }
        const result = def.innerType._zod.run(payload, ctx);
        if (result instanceof Promise) {
          return result.then((result2) => {
            payload.value = result2.issues.length === 0;
            return payload;
          });
        }
        payload.value = result.issues.length === 0;
        return payload;
      };
    });
    exports2.$ZodCatch = core.$constructor("$ZodCatch", (inst, def) => {
      exports2.$ZodType.init(inst, def);
      util.defineLazy(inst._zod, "optin", () => def.innerType._zod.optin);
      util.defineLazy(inst._zod, "optout", () => def.innerType._zod.optout);
      util.defineLazy(inst._zod, "values", () => def.innerType._zod.values);
      inst._zod.parse = (payload, ctx) => {
        if (ctx.direction === "backward") {
          return def.innerType._zod.run(payload, ctx);
        }
        const result = def.innerType._zod.run(payload, ctx);
        if (result instanceof Promise) {
          return result.then((result2) => {
            payload.value = result2.value;
            if (result2.issues.length) {
              payload.value = def.catchValue({
                ...payload,
                error: {
                  issues: result2.issues.map((iss) => util.finalizeIssue(iss, ctx, core.config()))
                },
                input: payload.value
              });
              payload.issues = [];
            }
            return payload;
          });
        }
        payload.value = result.value;
        if (result.issues.length) {
          payload.value = def.catchValue({
            ...payload,
            error: {
              issues: result.issues.map((iss) => util.finalizeIssue(iss, ctx, core.config()))
            },
            input: payload.value
          });
          payload.issues = [];
        }
        return payload;
      };
    });
    exports2.$ZodNaN = core.$constructor("$ZodNaN", (inst, def) => {
      exports2.$ZodType.init(inst, def);
      inst._zod.parse = (payload, _ctx) => {
        if (typeof payload.value !== "number" || !Number.isNaN(payload.value)) {
          payload.issues.push({
            input: payload.value,
            inst,
            expected: "nan",
            code: "invalid_type"
          });
          return payload;
        }
        return payload;
      };
    });
    exports2.$ZodPipe = core.$constructor("$ZodPipe", (inst, def) => {
      exports2.$ZodType.init(inst, def);
      util.defineLazy(inst._zod, "values", () => def.in._zod.values);
      util.defineLazy(inst._zod, "optin", () => def.in._zod.optin);
      util.defineLazy(inst._zod, "optout", () => def.out._zod.optout);
      util.defineLazy(inst._zod, "propValues", () => def.in._zod.propValues);
      inst._zod.parse = (payload, ctx) => {
        if (ctx.direction === "backward") {
          const right = def.out._zod.run(payload, ctx);
          if (right instanceof Promise) {
            return right.then((right2) => handlePipeResult(right2, def.in, ctx));
          }
          return handlePipeResult(right, def.in, ctx);
        }
        const left = def.in._zod.run(payload, ctx);
        if (left instanceof Promise) {
          return left.then((left2) => handlePipeResult(left2, def.out, ctx));
        }
        return handlePipeResult(left, def.out, ctx);
      };
    });
    function handlePipeResult(left, next, ctx) {
      if (left.issues.length) {
        left.aborted = true;
        return left;
      }
      return next._zod.run({ value: left.value, issues: left.issues }, ctx);
    }
    __name(handlePipeResult, "handlePipeResult");
    exports2.$ZodCodec = core.$constructor("$ZodCodec", (inst, def) => {
      exports2.$ZodType.init(inst, def);
      util.defineLazy(inst._zod, "values", () => def.in._zod.values);
      util.defineLazy(inst._zod, "optin", () => def.in._zod.optin);
      util.defineLazy(inst._zod, "optout", () => def.out._zod.optout);
      util.defineLazy(inst._zod, "propValues", () => def.in._zod.propValues);
      inst._zod.parse = (payload, ctx) => {
        const direction = ctx.direction || "forward";
        if (direction === "forward") {
          const left = def.in._zod.run(payload, ctx);
          if (left instanceof Promise) {
            return left.then((left2) => handleCodecAResult(left2, def, ctx));
          }
          return handleCodecAResult(left, def, ctx);
        } else {
          const right = def.out._zod.run(payload, ctx);
          if (right instanceof Promise) {
            return right.then((right2) => handleCodecAResult(right2, def, ctx));
          }
          return handleCodecAResult(right, def, ctx);
        }
      };
    });
    function handleCodecAResult(result, def, ctx) {
      if (result.issues.length) {
        result.aborted = true;
        return result;
      }
      const direction = ctx.direction || "forward";
      if (direction === "forward") {
        const transformed = def.transform(result.value, result);
        if (transformed instanceof Promise) {
          return transformed.then((value) => handleCodecTxResult(result, value, def.out, ctx));
        }
        return handleCodecTxResult(result, transformed, def.out, ctx);
      } else {
        const transformed = def.reverseTransform(result.value, result);
        if (transformed instanceof Promise) {
          return transformed.then((value) => handleCodecTxResult(result, value, def.in, ctx));
        }
        return handleCodecTxResult(result, transformed, def.in, ctx);
      }
    }
    __name(handleCodecAResult, "handleCodecAResult");
    function handleCodecTxResult(left, value, nextSchema, ctx) {
      if (left.issues.length) {
        left.aborted = true;
        return left;
      }
      return nextSchema._zod.run({ value, issues: left.issues }, ctx);
    }
    __name(handleCodecTxResult, "handleCodecTxResult");
    exports2.$ZodReadonly = core.$constructor("$ZodReadonly", (inst, def) => {
      exports2.$ZodType.init(inst, def);
      util.defineLazy(inst._zod, "propValues", () => def.innerType._zod.propValues);
      util.defineLazy(inst._zod, "values", () => def.innerType._zod.values);
      util.defineLazy(inst._zod, "optin", () => def.innerType?._zod?.optin);
      util.defineLazy(inst._zod, "optout", () => def.innerType?._zod?.optout);
      inst._zod.parse = (payload, ctx) => {
        if (ctx.direction === "backward") {
          return def.innerType._zod.run(payload, ctx);
        }
        const result = def.innerType._zod.run(payload, ctx);
        if (result instanceof Promise) {
          return result.then(handleReadonlyResult);
        }
        return handleReadonlyResult(result);
      };
    });
    function handleReadonlyResult(payload) {
      payload.value = Object.freeze(payload.value);
      return payload;
    }
    __name(handleReadonlyResult, "handleReadonlyResult");
    exports2.$ZodTemplateLiteral = core.$constructor("$ZodTemplateLiteral", (inst, def) => {
      exports2.$ZodType.init(inst, def);
      const regexParts = [];
      for (const part of def.parts) {
        if (typeof part === "object" && part !== null) {
          if (!part._zod.pattern) {
            throw new Error(`Invalid template literal part, no pattern found: ${[...part._zod.traits].shift()}`);
          }
          const source = part._zod.pattern instanceof RegExp ? part._zod.pattern.source : part._zod.pattern;
          if (!source)
            throw new Error(`Invalid template literal part: ${part._zod.traits}`);
          const start = source.startsWith("^") ? 1 : 0;
          const end = source.endsWith("$") ? source.length - 1 : source.length;
          regexParts.push(source.slice(start, end));
        } else if (part === null || util.primitiveTypes.has(typeof part)) {
          regexParts.push(util.escapeRegex(`${part}`));
        } else {
          throw new Error(`Invalid template literal part: ${part}`);
        }
      }
      inst._zod.pattern = new RegExp(`^${regexParts.join("")}$`);
      inst._zod.parse = (payload, _ctx) => {
        if (typeof payload.value !== "string") {
          payload.issues.push({
            input: payload.value,
            inst,
            expected: "string",
            code: "invalid_type"
          });
          return payload;
        }
        inst._zod.pattern.lastIndex = 0;
        if (!inst._zod.pattern.test(payload.value)) {
          payload.issues.push({
            input: payload.value,
            inst,
            code: "invalid_format",
            format: def.format ?? "template_literal",
            pattern: inst._zod.pattern.source
          });
          return payload;
        }
        return payload;
      };
    });
    exports2.$ZodFunction = core.$constructor("$ZodFunction", (inst, def) => {
      exports2.$ZodType.init(inst, def);
      inst._def = def;
      inst._zod.def = def;
      inst.implement = (func) => {
        if (typeof func !== "function") {
          throw new Error("implement() must be called with a function");
        }
        return function(...args) {
          const parsedArgs = inst._def.input ? (0, parse_js_1.parse)(inst._def.input, args) : args;
          const result = Reflect.apply(func, this, parsedArgs);
          if (inst._def.output) {
            return (0, parse_js_1.parse)(inst._def.output, result);
          }
          return result;
        };
      };
      inst.implementAsync = (func) => {
        if (typeof func !== "function") {
          throw new Error("implementAsync() must be called with a function");
        }
        return async function(...args) {
          const parsedArgs = inst._def.input ? await (0, parse_js_1.parseAsync)(inst._def.input, args) : args;
          const result = await Reflect.apply(func, this, parsedArgs);
          if (inst._def.output) {
            return await (0, parse_js_1.parseAsync)(inst._def.output, result);
          }
          return result;
        };
      };
      inst._zod.parse = (payload, _ctx) => {
        if (typeof payload.value !== "function") {
          payload.issues.push({
            code: "invalid_type",
            expected: "function",
            input: payload.value,
            inst
          });
          return payload;
        }
        const hasPromiseOutput = inst._def.output && inst._def.output._zod.def.type === "promise";
        if (hasPromiseOutput) {
          payload.value = inst.implementAsync(payload.value);
        } else {
          payload.value = inst.implement(payload.value);
        }
        return payload;
      };
      inst.input = (...args) => {
        const F = inst.constructor;
        if (Array.isArray(args[0])) {
          return new F({
            type: "function",
            input: new exports2.$ZodTuple({
              type: "tuple",
              items: args[0],
              rest: args[1]
            }),
            output: inst._def.output
          });
        }
        return new F({
          type: "function",
          input: args[0],
          output: inst._def.output
        });
      };
      inst.output = (output) => {
        const F = inst.constructor;
        return new F({
          type: "function",
          input: inst._def.input,
          output
        });
      };
      return inst;
    });
    exports2.$ZodPromise = core.$constructor("$ZodPromise", (inst, def) => {
      exports2.$ZodType.init(inst, def);
      inst._zod.parse = (payload, ctx) => {
        return Promise.resolve(payload.value).then((inner) => def.innerType._zod.run({ value: inner, issues: [] }, ctx));
      };
    });
    exports2.$ZodLazy = core.$constructor("$ZodLazy", (inst, def) => {
      exports2.$ZodType.init(inst, def);
      util.defineLazy(inst._zod, "innerType", () => def.getter());
      util.defineLazy(inst._zod, "pattern", () => inst._zod.innerType?._zod?.pattern);
      util.defineLazy(inst._zod, "propValues", () => inst._zod.innerType?._zod?.propValues);
      util.defineLazy(inst._zod, "optin", () => inst._zod.innerType?._zod?.optin ?? void 0);
      util.defineLazy(inst._zod, "optout", () => inst._zod.innerType?._zod?.optout ?? void 0);
      inst._zod.parse = (payload, ctx) => {
        const inner = inst._zod.innerType;
        return inner._zod.run(payload, ctx);
      };
    });
    exports2.$ZodCustom = core.$constructor("$ZodCustom", (inst, def) => {
      checks.$ZodCheck.init(inst, def);
      exports2.$ZodType.init(inst, def);
      inst._zod.parse = (payload, _) => {
        return payload;
      };
      inst._zod.check = (payload) => {
        const input = payload.value;
        const r = def.fn(input);
        if (r instanceof Promise) {
          return r.then((r2) => handleRefineResult(r2, payload, input, inst));
        }
        handleRefineResult(r, payload, input, inst);
        return;
      };
    });
    function handleRefineResult(result, payload, input, inst) {
      if (!result) {
        const _iss = {
          code: "custom",
          input,
          inst,
          // incorporates params.error into issue reporting
          path: [...inst._zod.def.path ?? []],
          // incorporates params.error into issue reporting
          continue: !inst._zod.def.abort
          // params: inst._zod.def.params,
        };
        if (inst._zod.def.params)
          _iss.params = inst._zod.def.params;
        payload.issues.push(util.issue(_iss));
      }
    }
    __name(handleRefineResult, "handleRefineResult");
  }
});

// node_modules/zod/v4/locales/ar.cjs
var require_ar = __commonJS({
  "node_modules/zod/v4/locales/ar.cjs"(exports2, module2) {
    "use strict";
    var __createBinding = exports2 && exports2.__createBinding || (Object.create ? (function(o, m, k, k2) {
      if (k2 === void 0) k2 = k;
      var desc = Object.getOwnPropertyDescriptor(m, k);
      if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
        desc = { enumerable: true, get: /* @__PURE__ */ __name(function() {
          return m[k];
        }, "get") };
      }
      Object.defineProperty(o, k2, desc);
    }) : (function(o, m, k, k2) {
      if (k2 === void 0) k2 = k;
      o[k2] = m[k];
    }));
    var __setModuleDefault = exports2 && exports2.__setModuleDefault || (Object.create ? (function(o, v) {
      Object.defineProperty(o, "default", { enumerable: true, value: v });
    }) : function(o, v) {
      o["default"] = v;
    });
    var __importStar = exports2 && exports2.__importStar || function(mod) {
      if (mod && mod.__esModule) return mod;
      var result = {};
      if (mod != null) {
        for (var k in mod) if (k !== "default" && Object.prototype.hasOwnProperty.call(mod, k)) __createBinding(result, mod, k);
      }
      __setModuleDefault(result, mod);
      return result;
    };
    Object.defineProperty(exports2, "__esModule", { value: true });
    exports2.default = default_1;
    var util = __importStar(require_util());
    var error = /* @__PURE__ */ __name(() => {
      const Sizable = {
        string: { unit: "\u062D\u0631\u0641", verb: "\u0623\u0646 \u064A\u062D\u0648\u064A" },
        file: { unit: "\u0628\u0627\u064A\u062A", verb: "\u0623\u0646 \u064A\u062D\u0648\u064A" },
        array: { unit: "\u0639\u0646\u0635\u0631", verb: "\u0623\u0646 \u064A\u062D\u0648\u064A" },
        set: { unit: "\u0639\u0646\u0635\u0631", verb: "\u0623\u0646 \u064A\u062D\u0648\u064A" }
      };
      function getSizing(origin) {
        return Sizable[origin] ?? null;
      }
      __name(getSizing, "getSizing");
      const FormatDictionary = {
        regex: "\u0645\u062F\u062E\u0644",
        email: "\u0628\u0631\u064A\u062F \u0625\u0644\u0643\u062A\u0631\u0648\u0646\u064A",
        url: "\u0631\u0627\u0628\u0637",
        emoji: "\u0625\u064A\u0645\u0648\u062C\u064A",
        uuid: "UUID",
        uuidv4: "UUIDv4",
        uuidv6: "UUIDv6",
        nanoid: "nanoid",
        guid: "GUID",
        cuid: "cuid",
        cuid2: "cuid2",
        ulid: "ULID",
        xid: "XID",
        ksuid: "KSUID",
        datetime: "\u062A\u0627\u0631\u064A\u062E \u0648\u0648\u0642\u062A \u0628\u0645\u0639\u064A\u0627\u0631 ISO",
        date: "\u062A\u0627\u0631\u064A\u062E \u0628\u0645\u0639\u064A\u0627\u0631 ISO",
        time: "\u0648\u0642\u062A \u0628\u0645\u0639\u064A\u0627\u0631 ISO",
        duration: "\u0645\u062F\u0629 \u0628\u0645\u0639\u064A\u0627\u0631 ISO",
        ipv4: "\u0639\u0646\u0648\u0627\u0646 IPv4",
        ipv6: "\u0639\u0646\u0648\u0627\u0646 IPv6",
        cidrv4: "\u0645\u062F\u0649 \u0639\u0646\u0627\u0648\u064A\u0646 \u0628\u0635\u064A\u063A\u0629 IPv4",
        cidrv6: "\u0645\u062F\u0649 \u0639\u0646\u0627\u0648\u064A\u0646 \u0628\u0635\u064A\u063A\u0629 IPv6",
        base64: "\u0646\u064E\u0635 \u0628\u062A\u0631\u0645\u064A\u0632 base64-encoded",
        base64url: "\u0646\u064E\u0635 \u0628\u062A\u0631\u0645\u064A\u0632 base64url-encoded",
        json_string: "\u0646\u064E\u0635 \u0639\u0644\u0649 \u0647\u064A\u0626\u0629 JSON",
        e164: "\u0631\u0642\u0645 \u0647\u0627\u062A\u0641 \u0628\u0645\u0639\u064A\u0627\u0631 E.164",
        jwt: "JWT",
        template_literal: "\u0645\u062F\u062E\u0644"
      };
      const TypeDictionary = {
        nan: "NaN"
      };
      return (issue) => {
        switch (issue.code) {
          case "invalid_type": {
            const expected = TypeDictionary[issue.expected] ?? issue.expected;
            const receivedType = util.parsedType(issue.input);
            const received = TypeDictionary[receivedType] ?? receivedType;
            if (/^[A-Z]/.test(issue.expected)) {
              return `\u0645\u062F\u062E\u0644\u0627\u062A \u063A\u064A\u0631 \u0645\u0642\u0628\u0648\u0644\u0629: \u064A\u0641\u062A\u0631\u0636 \u0625\u062F\u062E\u0627\u0644 instanceof ${issue.expected}\u060C \u0648\u0644\u0643\u0646 \u062A\u0645 \u0625\u062F\u062E\u0627\u0644 ${received}`;
            }
            return `\u0645\u062F\u062E\u0644\u0627\u062A \u063A\u064A\u0631 \u0645\u0642\u0628\u0648\u0644\u0629: \u064A\u0641\u062A\u0631\u0636 \u0625\u062F\u062E\u0627\u0644 ${expected}\u060C \u0648\u0644\u0643\u0646 \u062A\u0645 \u0625\u062F\u062E\u0627\u0644 ${received}`;
          }
          case "invalid_value":
            if (issue.values.length === 1)
              return `\u0645\u062F\u062E\u0644\u0627\u062A \u063A\u064A\u0631 \u0645\u0642\u0628\u0648\u0644\u0629: \u064A\u0641\u062A\u0631\u0636 \u0625\u062F\u062E\u0627\u0644 ${util.stringifyPrimitive(issue.values[0])}`;
            return `\u0627\u062E\u062A\u064A\u0627\u0631 \u063A\u064A\u0631 \u0645\u0642\u0628\u0648\u0644: \u064A\u062A\u0648\u0642\u0639 \u0627\u0646\u062A\u0642\u0627\u0621 \u0623\u062D\u062F \u0647\u0630\u0647 \u0627\u0644\u062E\u064A\u0627\u0631\u0627\u062A: ${util.joinValues(issue.values, "|")}`;
          case "too_big": {
            const adj = issue.inclusive ? "<=" : "<";
            const sizing = getSizing(issue.origin);
            if (sizing)
              return ` \u0623\u0643\u0628\u0631 \u0645\u0646 \u0627\u0644\u0644\u0627\u0632\u0645: \u064A\u0641\u062A\u0631\u0636 \u0623\u0646 \u062A\u0643\u0648\u0646 ${issue.origin ?? "\u0627\u0644\u0642\u064A\u0645\u0629"} ${adj} ${issue.maximum.toString()} ${sizing.unit ?? "\u0639\u0646\u0635\u0631"}`;
            return `\u0623\u0643\u0628\u0631 \u0645\u0646 \u0627\u0644\u0644\u0627\u0632\u0645: \u064A\u0641\u062A\u0631\u0636 \u0623\u0646 \u062A\u0643\u0648\u0646 ${issue.origin ?? "\u0627\u0644\u0642\u064A\u0645\u0629"} ${adj} ${issue.maximum.toString()}`;
          }
          case "too_small": {
            const adj = issue.inclusive ? ">=" : ">";
            const sizing = getSizing(issue.origin);
            if (sizing) {
              return `\u0623\u0635\u063A\u0631 \u0645\u0646 \u0627\u0644\u0644\u0627\u0632\u0645: \u064A\u0641\u062A\u0631\u0636 \u0644\u0640 ${issue.origin} \u0623\u0646 \u064A\u0643\u0648\u0646 ${adj} ${issue.minimum.toString()} ${sizing.unit}`;
            }
            return `\u0623\u0635\u063A\u0631 \u0645\u0646 \u0627\u0644\u0644\u0627\u0632\u0645: \u064A\u0641\u062A\u0631\u0636 \u0644\u0640 ${issue.origin} \u0623\u0646 \u064A\u0643\u0648\u0646 ${adj} ${issue.minimum.toString()}`;
          }
          case "invalid_format": {
            const _issue = issue;
            if (_issue.format === "starts_with")
              return `\u0646\u064E\u0635 \u063A\u064A\u0631 \u0645\u0642\u0628\u0648\u0644: \u064A\u062C\u0628 \u0623\u0646 \u064A\u0628\u062F\u0623 \u0628\u0640 "${issue.prefix}"`;
            if (_issue.format === "ends_with")
              return `\u0646\u064E\u0635 \u063A\u064A\u0631 \u0645\u0642\u0628\u0648\u0644: \u064A\u062C\u0628 \u0623\u0646 \u064A\u0646\u062A\u0647\u064A \u0628\u0640 "${_issue.suffix}"`;
            if (_issue.format === "includes")
              return `\u0646\u064E\u0635 \u063A\u064A\u0631 \u0645\u0642\u0628\u0648\u0644: \u064A\u062C\u0628 \u0623\u0646 \u064A\u062A\u0636\u0645\u0651\u064E\u0646 "${_issue.includes}"`;
            if (_issue.format === "regex")
              return `\u0646\u064E\u0635 \u063A\u064A\u0631 \u0645\u0642\u0628\u0648\u0644: \u064A\u062C\u0628 \u0623\u0646 \u064A\u0637\u0627\u0628\u0642 \u0627\u0644\u0646\u0645\u0637 ${_issue.pattern}`;
            return `${FormatDictionary[_issue.format] ?? issue.format} \u063A\u064A\u0631 \u0645\u0642\u0628\u0648\u0644`;
          }
          case "not_multiple_of":
            return `\u0631\u0642\u0645 \u063A\u064A\u0631 \u0645\u0642\u0628\u0648\u0644: \u064A\u062C\u0628 \u0623\u0646 \u064A\u0643\u0648\u0646 \u0645\u0646 \u0645\u0636\u0627\u0639\u0641\u0627\u062A ${issue.divisor}`;
          case "unrecognized_keys":
            return `\u0645\u0639\u0631\u0641${issue.keys.length > 1 ? "\u0627\u062A" : ""} \u063A\u0631\u064A\u0628${issue.keys.length > 1 ? "\u0629" : ""}: ${util.joinValues(issue.keys, "\u060C ")}`;
          case "invalid_key":
            return `\u0645\u0639\u0631\u0641 \u063A\u064A\u0631 \u0645\u0642\u0628\u0648\u0644 \u0641\u064A ${issue.origin}`;
          case "invalid_union":
            return "\u0645\u062F\u062E\u0644 \u063A\u064A\u0631 \u0645\u0642\u0628\u0648\u0644";
          case "invalid_element":
            return `\u0645\u062F\u062E\u0644 \u063A\u064A\u0631 \u0645\u0642\u0628\u0648\u0644 \u0641\u064A ${issue.origin}`;
          default:
            return "\u0645\u062F\u062E\u0644 \u063A\u064A\u0631 \u0645\u0642\u0628\u0648\u0644";
        }
      };
    }, "error");
    function default_1() {
      return {
        localeError: error()
      };
    }
    __name(default_1, "default_1");
    module2.exports = exports2.default;
  }
});

// node_modules/zod/v4/locales/az.cjs
var require_az = __commonJS({
  "node_modules/zod/v4/locales/az.cjs"(exports2, module2) {
    "use strict";
    var __createBinding = exports2 && exports2.__createBinding || (Object.create ? (function(o, m, k, k2) {
      if (k2 === void 0) k2 = k;
      var desc = Object.getOwnPropertyDescriptor(m, k);
      if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
        desc = { enumerable: true, get: /* @__PURE__ */ __name(function() {
          return m[k];
        }, "get") };
      }
      Object.defineProperty(o, k2, desc);
    }) : (function(o, m, k, k2) {
      if (k2 === void 0) k2 = k;
      o[k2] = m[k];
    }));
    var __setModuleDefault = exports2 && exports2.__setModuleDefault || (Object.create ? (function(o, v) {
      Object.defineProperty(o, "default", { enumerable: true, value: v });
    }) : function(o, v) {
      o["default"] = v;
    });
    var __importStar = exports2 && exports2.__importStar || function(mod) {
      if (mod && mod.__esModule) return mod;
      var result = {};
      if (mod != null) {
        for (var k in mod) if (k !== "default" && Object.prototype.hasOwnProperty.call(mod, k)) __createBinding(result, mod, k);
      }
      __setModuleDefault(result, mod);
      return result;
    };
    Object.defineProperty(exports2, "__esModule", { value: true });
    exports2.default = default_1;
    var util = __importStar(require_util());
    var error = /* @__PURE__ */ __name(() => {
      const Sizable = {
        string: { unit: "simvol", verb: "olmal\u0131d\u0131r" },
        file: { unit: "bayt", verb: "olmal\u0131d\u0131r" },
        array: { unit: "element", verb: "olmal\u0131d\u0131r" },
        set: { unit: "element", verb: "olmal\u0131d\u0131r" }
      };
      function getSizing(origin) {
        return Sizable[origin] ?? null;
      }
      __name(getSizing, "getSizing");
      const FormatDictionary = {
        regex: "input",
        email: "email address",
        url: "URL",
        emoji: "emoji",
        uuid: "UUID",
        uuidv4: "UUIDv4",
        uuidv6: "UUIDv6",
        nanoid: "nanoid",
        guid: "GUID",
        cuid: "cuid",
        cuid2: "cuid2",
        ulid: "ULID",
        xid: "XID",
        ksuid: "KSUID",
        datetime: "ISO datetime",
        date: "ISO date",
        time: "ISO time",
        duration: "ISO duration",
        ipv4: "IPv4 address",
        ipv6: "IPv6 address",
        cidrv4: "IPv4 range",
        cidrv6: "IPv6 range",
        base64: "base64-encoded string",
        base64url: "base64url-encoded string",
        json_string: "JSON string",
        e164: "E.164 number",
        jwt: "JWT",
        template_literal: "input"
      };
      const TypeDictionary = {
        nan: "NaN"
      };
      return (issue) => {
        switch (issue.code) {
          case "invalid_type": {
            const expected = TypeDictionary[issue.expected] ?? issue.expected;
            const receivedType = util.parsedType(issue.input);
            const received = TypeDictionary[receivedType] ?? receivedType;
            if (/^[A-Z]/.test(issue.expected)) {
              return `Yanl\u0131\u015F d\u0259y\u0259r: g\xF6zl\u0259nil\u0259n instanceof ${issue.expected}, daxil olan ${received}`;
            }
            return `Yanl\u0131\u015F d\u0259y\u0259r: g\xF6zl\u0259nil\u0259n ${expected}, daxil olan ${received}`;
          }
          case "invalid_value":
            if (issue.values.length === 1)
              return `Yanl\u0131\u015F d\u0259y\u0259r: g\xF6zl\u0259nil\u0259n ${util.stringifyPrimitive(issue.values[0])}`;
            return `Yanl\u0131\u015F se\xE7im: a\u015Fa\u011F\u0131dak\u0131lardan biri olmal\u0131d\u0131r: ${util.joinValues(issue.values, "|")}`;
          case "too_big": {
            const adj = issue.inclusive ? "<=" : "<";
            const sizing = getSizing(issue.origin);
            if (sizing)
              return `\xC7ox b\xF6y\xFCk: g\xF6zl\u0259nil\u0259n ${issue.origin ?? "d\u0259y\u0259r"} ${adj}${issue.maximum.toString()} ${sizing.unit ?? "element"}`;
            return `\xC7ox b\xF6y\xFCk: g\xF6zl\u0259nil\u0259n ${issue.origin ?? "d\u0259y\u0259r"} ${adj}${issue.maximum.toString()}`;
          }
          case "too_small": {
            const adj = issue.inclusive ? ">=" : ">";
            const sizing = getSizing(issue.origin);
            if (sizing)
              return `\xC7ox ki\xE7ik: g\xF6zl\u0259nil\u0259n ${issue.origin} ${adj}${issue.minimum.toString()} ${sizing.unit}`;
            return `\xC7ox ki\xE7ik: g\xF6zl\u0259nil\u0259n ${issue.origin} ${adj}${issue.minimum.toString()}`;
          }
          case "invalid_format": {
            const _issue = issue;
            if (_issue.format === "starts_with")
              return `Yanl\u0131\u015F m\u0259tn: "${_issue.prefix}" il\u0259 ba\u015Flamal\u0131d\u0131r`;
            if (_issue.format === "ends_with")
              return `Yanl\u0131\u015F m\u0259tn: "${_issue.suffix}" il\u0259 bitm\u0259lidir`;
            if (_issue.format === "includes")
              return `Yanl\u0131\u015F m\u0259tn: "${_issue.includes}" daxil olmal\u0131d\u0131r`;
            if (_issue.format === "regex")
              return `Yanl\u0131\u015F m\u0259tn: ${_issue.pattern} \u015Fablonuna uy\u011Fun olmal\u0131d\u0131r`;
            return `Yanl\u0131\u015F ${FormatDictionary[_issue.format] ?? issue.format}`;
          }
          case "not_multiple_of":
            return `Yanl\u0131\u015F \u0259d\u0259d: ${issue.divisor} il\u0259 b\xF6l\xFCn\u0259 bil\u0259n olmal\u0131d\u0131r`;
          case "unrecognized_keys":
            return `Tan\u0131nmayan a\xE7ar${issue.keys.length > 1 ? "lar" : ""}: ${util.joinValues(issue.keys, ", ")}`;
          case "invalid_key":
            return `${issue.origin} daxilind\u0259 yanl\u0131\u015F a\xE7ar`;
          case "invalid_union":
            return "Yanl\u0131\u015F d\u0259y\u0259r";
          case "invalid_element":
            return `${issue.origin} daxilind\u0259 yanl\u0131\u015F d\u0259y\u0259r`;
          default:
            return `Yanl\u0131\u015F d\u0259y\u0259r`;
        }
      };
    }, "error");
    function default_1() {
      return {
        localeError: error()
      };
    }
    __name(default_1, "default_1");
    module2.exports = exports2.default;
  }
});

// node_modules/zod/v4/locales/be.cjs
var require_be = __commonJS({
  "node_modules/zod/v4/locales/be.cjs"(exports2, module2) {
    "use strict";
    var __createBinding = exports2 && exports2.__createBinding || (Object.create ? (function(o, m, k, k2) {
      if (k2 === void 0) k2 = k;
      var desc = Object.getOwnPropertyDescriptor(m, k);
      if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
        desc = { enumerable: true, get: /* @__PURE__ */ __name(function() {
          return m[k];
        }, "get") };
      }
      Object.defineProperty(o, k2, desc);
    }) : (function(o, m, k, k2) {
      if (k2 === void 0) k2 = k;
      o[k2] = m[k];
    }));
    var __setModuleDefault = exports2 && exports2.__setModuleDefault || (Object.create ? (function(o, v) {
      Object.defineProperty(o, "default", { enumerable: true, value: v });
    }) : function(o, v) {
      o["default"] = v;
    });
    var __importStar = exports2 && exports2.__importStar || function(mod) {
      if (mod && mod.__esModule) return mod;
      var result = {};
      if (mod != null) {
        for (var k in mod) if (k !== "default" && Object.prototype.hasOwnProperty.call(mod, k)) __createBinding(result, mod, k);
      }
      __setModuleDefault(result, mod);
      return result;
    };
    Object.defineProperty(exports2, "__esModule", { value: true });
    exports2.default = default_1;
    var util = __importStar(require_util());
    function getBelarusianPlural(count, one, few, many) {
      const absCount = Math.abs(count);
      const lastDigit = absCount % 10;
      const lastTwoDigits = absCount % 100;
      if (lastTwoDigits >= 11 && lastTwoDigits <= 19) {
        return many;
      }
      if (lastDigit === 1) {
        return one;
      }
      if (lastDigit >= 2 && lastDigit <= 4) {
        return few;
      }
      return many;
    }
    __name(getBelarusianPlural, "getBelarusianPlural");
    var error = /* @__PURE__ */ __name(() => {
      const Sizable = {
        string: {
          unit: {
            one: "\u0441\u0456\u043C\u0432\u0430\u043B",
            few: "\u0441\u0456\u043C\u0432\u0430\u043B\u044B",
            many: "\u0441\u0456\u043C\u0432\u0430\u043B\u0430\u045E"
          },
          verb: "\u043C\u0435\u0446\u044C"
        },
        array: {
          unit: {
            one: "\u044D\u043B\u0435\u043C\u0435\u043D\u0442",
            few: "\u044D\u043B\u0435\u043C\u0435\u043D\u0442\u044B",
            many: "\u044D\u043B\u0435\u043C\u0435\u043D\u0442\u0430\u045E"
          },
          verb: "\u043C\u0435\u0446\u044C"
        },
        set: {
          unit: {
            one: "\u044D\u043B\u0435\u043C\u0435\u043D\u0442",
            few: "\u044D\u043B\u0435\u043C\u0435\u043D\u0442\u044B",
            many: "\u044D\u043B\u0435\u043C\u0435\u043D\u0442\u0430\u045E"
          },
          verb: "\u043C\u0435\u0446\u044C"
        },
        file: {
          unit: {
            one: "\u0431\u0430\u0439\u0442",
            few: "\u0431\u0430\u0439\u0442\u044B",
            many: "\u0431\u0430\u0439\u0442\u0430\u045E"
          },
          verb: "\u043C\u0435\u0446\u044C"
        }
      };
      function getSizing(origin) {
        return Sizable[origin] ?? null;
      }
      __name(getSizing, "getSizing");
      const FormatDictionary = {
        regex: "\u0443\u0432\u043E\u0434",
        email: "email \u0430\u0434\u0440\u0430\u0441",
        url: "URL",
        emoji: "\u044D\u043C\u043E\u0434\u0437\u0456",
        uuid: "UUID",
        uuidv4: "UUIDv4",
        uuidv6: "UUIDv6",
        nanoid: "nanoid",
        guid: "GUID",
        cuid: "cuid",
        cuid2: "cuid2",
        ulid: "ULID",
        xid: "XID",
        ksuid: "KSUID",
        datetime: "ISO \u0434\u0430\u0442\u0430 \u0456 \u0447\u0430\u0441",
        date: "ISO \u0434\u0430\u0442\u0430",
        time: "ISO \u0447\u0430\u0441",
        duration: "ISO \u043F\u0440\u0430\u0446\u044F\u0433\u043B\u0430\u0441\u0446\u044C",
        ipv4: "IPv4 \u0430\u0434\u0440\u0430\u0441",
        ipv6: "IPv6 \u0430\u0434\u0440\u0430\u0441",
        cidrv4: "IPv4 \u0434\u044B\u044F\u043F\u0430\u0437\u043E\u043D",
        cidrv6: "IPv6 \u0434\u044B\u044F\u043F\u0430\u0437\u043E\u043D",
        base64: "\u0440\u0430\u0434\u043E\u043A \u0443 \u0444\u0430\u0440\u043C\u0430\u0446\u0435 base64",
        base64url: "\u0440\u0430\u0434\u043E\u043A \u0443 \u0444\u0430\u0440\u043C\u0430\u0446\u0435 base64url",
        json_string: "JSON \u0440\u0430\u0434\u043E\u043A",
        e164: "\u043D\u0443\u043C\u0430\u0440 E.164",
        jwt: "JWT",
        template_literal: "\u0443\u0432\u043E\u0434"
      };
      const TypeDictionary = {
        nan: "NaN",
        number: "\u043B\u0456\u043A",
        array: "\u043C\u0430\u0441\u0456\u045E"
      };
      return (issue) => {
        switch (issue.code) {
          case "invalid_type": {
            const expected = TypeDictionary[issue.expected] ?? issue.expected;
            const receivedType = util.parsedType(issue.input);
            const received = TypeDictionary[receivedType] ?? receivedType;
            if (/^[A-Z]/.test(issue.expected)) {
              return `\u041D\u044F\u043F\u0440\u0430\u0432\u0456\u043B\u044C\u043D\u044B \u045E\u0432\u043E\u0434: \u0447\u0430\u043A\u0430\u045E\u0441\u044F instanceof ${issue.expected}, \u0430\u0442\u0440\u044B\u043C\u0430\u043D\u0430 ${received}`;
            }
            return `\u041D\u044F\u043F\u0440\u0430\u0432\u0456\u043B\u044C\u043D\u044B \u045E\u0432\u043E\u0434: \u0447\u0430\u043A\u0430\u045E\u0441\u044F ${expected}, \u0430\u0442\u0440\u044B\u043C\u0430\u043D\u0430 ${received}`;
          }
          case "invalid_value":
            if (issue.values.length === 1)
              return `\u041D\u044F\u043F\u0440\u0430\u0432\u0456\u043B\u044C\u043D\u044B \u045E\u0432\u043E\u0434: \u0447\u0430\u043A\u0430\u043B\u0430\u0441\u044F ${util.stringifyPrimitive(issue.values[0])}`;
            return `\u041D\u044F\u043F\u0440\u0430\u0432\u0456\u043B\u044C\u043D\u044B \u0432\u0430\u0440\u044B\u044F\u043D\u0442: \u0447\u0430\u043A\u0430\u045E\u0441\u044F \u0430\u0434\u0437\u0456\u043D \u0437 ${util.joinValues(issue.values, "|")}`;
          case "too_big": {
            const adj = issue.inclusive ? "<=" : "<";
            const sizing = getSizing(issue.origin);
            if (sizing) {
              const maxValue = Number(issue.maximum);
              const unit = getBelarusianPlural(maxValue, sizing.unit.one, sizing.unit.few, sizing.unit.many);
              return `\u0417\u0430\u043D\u0430\u0434\u0442\u0430 \u0432\u044F\u043B\u0456\u043A\u0456: \u0447\u0430\u043A\u0430\u043B\u0430\u0441\u044F, \u0448\u0442\u043E ${issue.origin ?? "\u0437\u043D\u0430\u0447\u044D\u043D\u043D\u0435"} \u043F\u0430\u0432\u0456\u043D\u043D\u0430 ${sizing.verb} ${adj}${issue.maximum.toString()} ${unit}`;
            }
            return `\u0417\u0430\u043D\u0430\u0434\u0442\u0430 \u0432\u044F\u043B\u0456\u043A\u0456: \u0447\u0430\u043A\u0430\u043B\u0430\u0441\u044F, \u0448\u0442\u043E ${issue.origin ?? "\u0437\u043D\u0430\u0447\u044D\u043D\u043D\u0435"} \u043F\u0430\u0432\u0456\u043D\u043D\u0430 \u0431\u044B\u0446\u044C ${adj}${issue.maximum.toString()}`;
          }
          case "too_small": {
            const adj = issue.inclusive ? ">=" : ">";
            const sizing = getSizing(issue.origin);
            if (sizing) {
              const minValue = Number(issue.minimum);
              const unit = getBelarusianPlural(minValue, sizing.unit.one, sizing.unit.few, sizing.unit.many);
              return `\u0417\u0430\u043D\u0430\u0434\u0442\u0430 \u043C\u0430\u043B\u044B: \u0447\u0430\u043A\u0430\u043B\u0430\u0441\u044F, \u0448\u0442\u043E ${issue.origin} \u043F\u0430\u0432\u0456\u043D\u043D\u0430 ${sizing.verb} ${adj}${issue.minimum.toString()} ${unit}`;
            }
            return `\u0417\u0430\u043D\u0430\u0434\u0442\u0430 \u043C\u0430\u043B\u044B: \u0447\u0430\u043A\u0430\u043B\u0430\u0441\u044F, \u0448\u0442\u043E ${issue.origin} \u043F\u0430\u0432\u0456\u043D\u043D\u0430 \u0431\u044B\u0446\u044C ${adj}${issue.minimum.toString()}`;
          }
          case "invalid_format": {
            const _issue = issue;
            if (_issue.format === "starts_with")
              return `\u041D\u044F\u043F\u0440\u0430\u0432\u0456\u043B\u044C\u043D\u044B \u0440\u0430\u0434\u043E\u043A: \u043F\u0430\u0432\u0456\u043D\u0435\u043D \u043F\u0430\u0447\u044B\u043D\u0430\u0446\u0446\u0430 \u0437 "${_issue.prefix}"`;
            if (_issue.format === "ends_with")
              return `\u041D\u044F\u043F\u0440\u0430\u0432\u0456\u043B\u044C\u043D\u044B \u0440\u0430\u0434\u043E\u043A: \u043F\u0430\u0432\u0456\u043D\u0435\u043D \u0437\u0430\u043A\u0430\u043D\u0447\u0432\u0430\u0446\u0446\u0430 \u043D\u0430 "${_issue.suffix}"`;
            if (_issue.format === "includes")
              return `\u041D\u044F\u043F\u0440\u0430\u0432\u0456\u043B\u044C\u043D\u044B \u0440\u0430\u0434\u043E\u043A: \u043F\u0430\u0432\u0456\u043D\u0435\u043D \u0437\u043C\u044F\u0448\u0447\u0430\u0446\u044C "${_issue.includes}"`;
            if (_issue.format === "regex")
              return `\u041D\u044F\u043F\u0440\u0430\u0432\u0456\u043B\u044C\u043D\u044B \u0440\u0430\u0434\u043E\u043A: \u043F\u0430\u0432\u0456\u043D\u0435\u043D \u0430\u0434\u043F\u0430\u0432\u044F\u0434\u0430\u0446\u044C \u0448\u0430\u0431\u043B\u043E\u043D\u0443 ${_issue.pattern}`;
            return `\u041D\u044F\u043F\u0440\u0430\u0432\u0456\u043B\u044C\u043D\u044B ${FormatDictionary[_issue.format] ?? issue.format}`;
          }
          case "not_multiple_of":
            return `\u041D\u044F\u043F\u0440\u0430\u0432\u0456\u043B\u044C\u043D\u044B \u043B\u0456\u043A: \u043F\u0430\u0432\u0456\u043D\u0435\u043D \u0431\u044B\u0446\u044C \u043A\u0440\u0430\u0442\u043D\u044B\u043C ${issue.divisor}`;
          case "unrecognized_keys":
            return `\u041D\u0435\u0440\u0430\u0441\u043F\u0430\u0437\u043D\u0430\u043D\u044B ${issue.keys.length > 1 ? "\u043A\u043B\u044E\u0447\u044B" : "\u043A\u043B\u044E\u0447"}: ${util.joinValues(issue.keys, ", ")}`;
          case "invalid_key":
            return `\u041D\u044F\u043F\u0440\u0430\u0432\u0456\u043B\u044C\u043D\u044B \u043A\u043B\u044E\u0447 \u0443 ${issue.origin}`;
          case "invalid_union":
            return "\u041D\u044F\u043F\u0440\u0430\u0432\u0456\u043B\u044C\u043D\u044B \u045E\u0432\u043E\u0434";
          case "invalid_element":
            return `\u041D\u044F\u043F\u0440\u0430\u0432\u0456\u043B\u044C\u043D\u0430\u0435 \u0437\u043D\u0430\u0447\u044D\u043D\u043D\u0435 \u045E ${issue.origin}`;
          default:
            return `\u041D\u044F\u043F\u0440\u0430\u0432\u0456\u043B\u044C\u043D\u044B \u045E\u0432\u043E\u0434`;
        }
      };
    }, "error");
    function default_1() {
      return {
        localeError: error()
      };
    }
    __name(default_1, "default_1");
    module2.exports = exports2.default;
  }
});

// node_modules/zod/v4/locales/bg.cjs
var require_bg = __commonJS({
  "node_modules/zod/v4/locales/bg.cjs"(exports2, module2) {
    "use strict";
    var __createBinding = exports2 && exports2.__createBinding || (Object.create ? (function(o, m, k, k2) {
      if (k2 === void 0) k2 = k;
      var desc = Object.getOwnPropertyDescriptor(m, k);
      if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
        desc = { enumerable: true, get: /* @__PURE__ */ __name(function() {
          return m[k];
        }, "get") };
      }
      Object.defineProperty(o, k2, desc);
    }) : (function(o, m, k, k2) {
      if (k2 === void 0) k2 = k;
      o[k2] = m[k];
    }));
    var __setModuleDefault = exports2 && exports2.__setModuleDefault || (Object.create ? (function(o, v) {
      Object.defineProperty(o, "default", { enumerable: true, value: v });
    }) : function(o, v) {
      o["default"] = v;
    });
    var __importStar = exports2 && exports2.__importStar || function(mod) {
      if (mod && mod.__esModule) return mod;
      var result = {};
      if (mod != null) {
        for (var k in mod) if (k !== "default" && Object.prototype.hasOwnProperty.call(mod, k)) __createBinding(result, mod, k);
      }
      __setModuleDefault(result, mod);
      return result;
    };
    Object.defineProperty(exports2, "__esModule", { value: true });
    exports2.default = default_1;
    var util = __importStar(require_util());
    var error = /* @__PURE__ */ __name(() => {
      const Sizable = {
        string: { unit: "\u0441\u0438\u043C\u0432\u043E\u043B\u0430", verb: "\u0434\u0430 \u0441\u044A\u0434\u044A\u0440\u0436\u0430" },
        file: { unit: "\u0431\u0430\u0439\u0442\u0430", verb: "\u0434\u0430 \u0441\u044A\u0434\u044A\u0440\u0436\u0430" },
        array: { unit: "\u0435\u043B\u0435\u043C\u0435\u043D\u0442\u0430", verb: "\u0434\u0430 \u0441\u044A\u0434\u044A\u0440\u0436\u0430" },
        set: { unit: "\u0435\u043B\u0435\u043C\u0435\u043D\u0442\u0430", verb: "\u0434\u0430 \u0441\u044A\u0434\u044A\u0440\u0436\u0430" }
      };
      function getSizing(origin) {
        return Sizable[origin] ?? null;
      }
      __name(getSizing, "getSizing");
      const FormatDictionary = {
        regex: "\u0432\u0445\u043E\u0434",
        email: "\u0438\u043C\u0435\u0439\u043B \u0430\u0434\u0440\u0435\u0441",
        url: "URL",
        emoji: "\u0435\u043C\u043E\u0434\u0436\u0438",
        uuid: "UUID",
        uuidv4: "UUIDv4",
        uuidv6: "UUIDv6",
        nanoid: "nanoid",
        guid: "GUID",
        cuid: "cuid",
        cuid2: "cuid2",
        ulid: "ULID",
        xid: "XID",
        ksuid: "KSUID",
        datetime: "ISO \u0432\u0440\u0435\u043C\u0435",
        date: "ISO \u0434\u0430\u0442\u0430",
        time: "ISO \u0432\u0440\u0435\u043C\u0435",
        duration: "ISO \u043F\u0440\u043E\u0434\u044A\u043B\u0436\u0438\u0442\u0435\u043B\u043D\u043E\u0441\u0442",
        ipv4: "IPv4 \u0430\u0434\u0440\u0435\u0441",
        ipv6: "IPv6 \u0430\u0434\u0440\u0435\u0441",
        cidrv4: "IPv4 \u0434\u0438\u0430\u043F\u0430\u0437\u043E\u043D",
        cidrv6: "IPv6 \u0434\u0438\u0430\u043F\u0430\u0437\u043E\u043D",
        base64: "base64-\u043A\u043E\u0434\u0438\u0440\u0430\u043D \u043D\u0438\u0437",
        base64url: "base64url-\u043A\u043E\u0434\u0438\u0440\u0430\u043D \u043D\u0438\u0437",
        json_string: "JSON \u043D\u0438\u0437",
        e164: "E.164 \u043D\u043E\u043C\u0435\u0440",
        jwt: "JWT",
        template_literal: "\u0432\u0445\u043E\u0434"
      };
      const TypeDictionary = {
        nan: "NaN",
        number: "\u0447\u0438\u0441\u043B\u043E",
        array: "\u043C\u0430\u0441\u0438\u0432"
      };
      return (issue) => {
        switch (issue.code) {
          case "invalid_type": {
            const expected = TypeDictionary[issue.expected] ?? issue.expected;
            const receivedType = util.parsedType(issue.input);
            const received = TypeDictionary[receivedType] ?? receivedType;
            if (/^[A-Z]/.test(issue.expected)) {
              return `\u041D\u0435\u0432\u0430\u043B\u0438\u0434\u0435\u043D \u0432\u0445\u043E\u0434: \u043E\u0447\u0430\u043A\u0432\u0430\u043D instanceof ${issue.expected}, \u043F\u043E\u043B\u0443\u0447\u0435\u043D ${received}`;
            }
            return `\u041D\u0435\u0432\u0430\u043B\u0438\u0434\u0435\u043D \u0432\u0445\u043E\u0434: \u043E\u0447\u0430\u043A\u0432\u0430\u043D ${expected}, \u043F\u043E\u043B\u0443\u0447\u0435\u043D ${received}`;
          }
          case "invalid_value":
            if (issue.values.length === 1)
              return `\u041D\u0435\u0432\u0430\u043B\u0438\u0434\u0435\u043D \u0432\u0445\u043E\u0434: \u043E\u0447\u0430\u043A\u0432\u0430\u043D ${util.stringifyPrimitive(issue.values[0])}`;
            return `\u041D\u0435\u0432\u0430\u043B\u0438\u0434\u043D\u0430 \u043E\u043F\u0446\u0438\u044F: \u043E\u0447\u0430\u043A\u0432\u0430\u043D\u043E \u0435\u0434\u043D\u043E \u043E\u0442 ${util.joinValues(issue.values, "|")}`;
          case "too_big": {
            const adj = issue.inclusive ? "<=" : "<";
            const sizing = getSizing(issue.origin);
            if (sizing)
              return `\u0422\u0432\u044A\u0440\u0434\u0435 \u0433\u043E\u043B\u044F\u043C\u043E: \u043E\u0447\u0430\u043A\u0432\u0430 \u0441\u0435 ${issue.origin ?? "\u0441\u0442\u043E\u0439\u043D\u043E\u0441\u0442"} \u0434\u0430 \u0441\u044A\u0434\u044A\u0440\u0436\u0430 ${adj}${issue.maximum.toString()} ${sizing.unit ?? "\u0435\u043B\u0435\u043C\u0435\u043D\u0442\u0430"}`;
            return `\u0422\u0432\u044A\u0440\u0434\u0435 \u0433\u043E\u043B\u044F\u043C\u043E: \u043E\u0447\u0430\u043A\u0432\u0430 \u0441\u0435 ${issue.origin ?? "\u0441\u0442\u043E\u0439\u043D\u043E\u0441\u0442"} \u0434\u0430 \u0431\u044A\u0434\u0435 ${adj}${issue.maximum.toString()}`;
          }
          case "too_small": {
            const adj = issue.inclusive ? ">=" : ">";
            const sizing = getSizing(issue.origin);
            if (sizing) {
              return `\u0422\u0432\u044A\u0440\u0434\u0435 \u043C\u0430\u043B\u043A\u043E: \u043E\u0447\u0430\u043A\u0432\u0430 \u0441\u0435 ${issue.origin} \u0434\u0430 \u0441\u044A\u0434\u044A\u0440\u0436\u0430 ${adj}${issue.minimum.toString()} ${sizing.unit}`;
            }
            return `\u0422\u0432\u044A\u0440\u0434\u0435 \u043C\u0430\u043B\u043A\u043E: \u043E\u0447\u0430\u043A\u0432\u0430 \u0441\u0435 ${issue.origin} \u0434\u0430 \u0431\u044A\u0434\u0435 ${adj}${issue.minimum.toString()}`;
          }
          case "invalid_format": {
            const _issue = issue;
            if (_issue.format === "starts_with") {
              return `\u041D\u0435\u0432\u0430\u043B\u0438\u0434\u0435\u043D \u043D\u0438\u0437: \u0442\u0440\u044F\u0431\u0432\u0430 \u0434\u0430 \u0437\u0430\u043F\u043E\u0447\u0432\u0430 \u0441 "${_issue.prefix}"`;
            }
            if (_issue.format === "ends_with")
              return `\u041D\u0435\u0432\u0430\u043B\u0438\u0434\u0435\u043D \u043D\u0438\u0437: \u0442\u0440\u044F\u0431\u0432\u0430 \u0434\u0430 \u0437\u0430\u0432\u044A\u0440\u0448\u0432\u0430 \u0441 "${_issue.suffix}"`;
            if (_issue.format === "includes")
              return `\u041D\u0435\u0432\u0430\u043B\u0438\u0434\u0435\u043D \u043D\u0438\u0437: \u0442\u0440\u044F\u0431\u0432\u0430 \u0434\u0430 \u0432\u043A\u043B\u044E\u0447\u0432\u0430 "${_issue.includes}"`;
            if (_issue.format === "regex")
              return `\u041D\u0435\u0432\u0430\u043B\u0438\u0434\u0435\u043D \u043D\u0438\u0437: \u0442\u0440\u044F\u0431\u0432\u0430 \u0434\u0430 \u0441\u044A\u0432\u043F\u0430\u0434\u0430 \u0441 ${_issue.pattern}`;
            let invalid_adj = "\u041D\u0435\u0432\u0430\u043B\u0438\u0434\u0435\u043D";
            if (_issue.format === "emoji")
              invalid_adj = "\u041D\u0435\u0432\u0430\u043B\u0438\u0434\u043D\u043E";
            if (_issue.format === "datetime")
              invalid_adj = "\u041D\u0435\u0432\u0430\u043B\u0438\u0434\u043D\u043E";
            if (_issue.format === "date")
              invalid_adj = "\u041D\u0435\u0432\u0430\u043B\u0438\u0434\u043D\u0430";
            if (_issue.format === "time")
              invalid_adj = "\u041D\u0435\u0432\u0430\u043B\u0438\u0434\u043D\u043E";
            if (_issue.format === "duration")
              invalid_adj = "\u041D\u0435\u0432\u0430\u043B\u0438\u0434\u043D\u0430";
            return `${invalid_adj} ${FormatDictionary[_issue.format] ?? issue.format}`;
          }
          case "not_multiple_of":
            return `\u041D\u0435\u0432\u0430\u043B\u0438\u0434\u043D\u043E \u0447\u0438\u0441\u043B\u043E: \u0442\u0440\u044F\u0431\u0432\u0430 \u0434\u0430 \u0431\u044A\u0434\u0435 \u043A\u0440\u0430\u0442\u043D\u043E \u043D\u0430 ${issue.divisor}`;
          case "unrecognized_keys":
            return `\u041D\u0435\u0440\u0430\u0437\u043F\u043E\u0437\u043D\u0430\u0442${issue.keys.length > 1 ? "\u0438" : ""} \u043A\u043B\u044E\u0447${issue.keys.length > 1 ? "\u043E\u0432\u0435" : ""}: ${util.joinValues(issue.keys, ", ")}`;
          case "invalid_key":
            return `\u041D\u0435\u0432\u0430\u043B\u0438\u0434\u0435\u043D \u043A\u043B\u044E\u0447 \u0432 ${issue.origin}`;
          case "invalid_union":
            return "\u041D\u0435\u0432\u0430\u043B\u0438\u0434\u0435\u043D \u0432\u0445\u043E\u0434";
          case "invalid_element":
            return `\u041D\u0435\u0432\u0430\u043B\u0438\u0434\u043D\u0430 \u0441\u0442\u043E\u0439\u043D\u043E\u0441\u0442 \u0432 ${issue.origin}`;
          default:
            return `\u041D\u0435\u0432\u0430\u043B\u0438\u0434\u0435\u043D \u0432\u0445\u043E\u0434`;
        }
      };
    }, "error");
    function default_1() {
      return {
        localeError: error()
      };
    }
    __name(default_1, "default_1");
    module2.exports = exports2.default;
  }
});

// node_modules/zod/v4/locales/ca.cjs
var require_ca = __commonJS({
  "node_modules/zod/v4/locales/ca.cjs"(exports2, module2) {
    "use strict";
    var __createBinding = exports2 && exports2.__createBinding || (Object.create ? (function(o, m, k, k2) {
      if (k2 === void 0) k2 = k;
      var desc = Object.getOwnPropertyDescriptor(m, k);
      if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
        desc = { enumerable: true, get: /* @__PURE__ */ __name(function() {
          return m[k];
        }, "get") };
      }
      Object.defineProperty(o, k2, desc);
    }) : (function(o, m, k, k2) {
      if (k2 === void 0) k2 = k;
      o[k2] = m[k];
    }));
    var __setModuleDefault = exports2 && exports2.__setModuleDefault || (Object.create ? (function(o, v) {
      Object.defineProperty(o, "default", { enumerable: true, value: v });
    }) : function(o, v) {
      o["default"] = v;
    });
    var __importStar = exports2 && exports2.__importStar || function(mod) {
      if (mod && mod.__esModule) return mod;
      var result = {};
      if (mod != null) {
        for (var k in mod) if (k !== "default" && Object.prototype.hasOwnProperty.call(mod, k)) __createBinding(result, mod, k);
      }
      __setModuleDefault(result, mod);
      return result;
    };
    Object.defineProperty(exports2, "__esModule", { value: true });
    exports2.default = default_1;
    var util = __importStar(require_util());
    var error = /* @__PURE__ */ __name(() => {
      const Sizable = {
        string: { unit: "car\xE0cters", verb: "contenir" },
        file: { unit: "bytes", verb: "contenir" },
        array: { unit: "elements", verb: "contenir" },
        set: { unit: "elements", verb: "contenir" }
      };
      function getSizing(origin) {
        return Sizable[origin] ?? null;
      }
      __name(getSizing, "getSizing");
      const FormatDictionary = {
        regex: "entrada",
        email: "adre\xE7a electr\xF2nica",
        url: "URL",
        emoji: "emoji",
        uuid: "UUID",
        uuidv4: "UUIDv4",
        uuidv6: "UUIDv6",
        nanoid: "nanoid",
        guid: "GUID",
        cuid: "cuid",
        cuid2: "cuid2",
        ulid: "ULID",
        xid: "XID",
        ksuid: "KSUID",
        datetime: "data i hora ISO",
        date: "data ISO",
        time: "hora ISO",
        duration: "durada ISO",
        ipv4: "adre\xE7a IPv4",
        ipv6: "adre\xE7a IPv6",
        cidrv4: "rang IPv4",
        cidrv6: "rang IPv6",
        base64: "cadena codificada en base64",
        base64url: "cadena codificada en base64url",
        json_string: "cadena JSON",
        e164: "n\xFAmero E.164",
        jwt: "JWT",
        template_literal: "entrada"
      };
      const TypeDictionary = {
        nan: "NaN"
      };
      return (issue) => {
        switch (issue.code) {
          case "invalid_type": {
            const expected = TypeDictionary[issue.expected] ?? issue.expected;
            const receivedType = util.parsedType(issue.input);
            const received = TypeDictionary[receivedType] ?? receivedType;
            if (/^[A-Z]/.test(issue.expected)) {
              return `Tipus inv\xE0lid: s'esperava instanceof ${issue.expected}, s'ha rebut ${received}`;
            }
            return `Tipus inv\xE0lid: s'esperava ${expected}, s'ha rebut ${received}`;
          }
          case "invalid_value":
            if (issue.values.length === 1)
              return `Valor inv\xE0lid: s'esperava ${util.stringifyPrimitive(issue.values[0])}`;
            return `Opci\xF3 inv\xE0lida: s'esperava una de ${util.joinValues(issue.values, " o ")}`;
          case "too_big": {
            const adj = issue.inclusive ? "com a m\xE0xim" : "menys de";
            const sizing = getSizing(issue.origin);
            if (sizing)
              return `Massa gran: s'esperava que ${issue.origin ?? "el valor"} contingu\xE9s ${adj} ${issue.maximum.toString()} ${sizing.unit ?? "elements"}`;
            return `Massa gran: s'esperava que ${issue.origin ?? "el valor"} fos ${adj} ${issue.maximum.toString()}`;
          }
          case "too_small": {
            const adj = issue.inclusive ? "com a m\xEDnim" : "m\xE9s de";
            const sizing = getSizing(issue.origin);
            if (sizing) {
              return `Massa petit: s'esperava que ${issue.origin} contingu\xE9s ${adj} ${issue.minimum.toString()} ${sizing.unit}`;
            }
            return `Massa petit: s'esperava que ${issue.origin} fos ${adj} ${issue.minimum.toString()}`;
          }
          case "invalid_format": {
            const _issue = issue;
            if (_issue.format === "starts_with") {
              return `Format inv\xE0lid: ha de comen\xE7ar amb "${_issue.prefix}"`;
            }
            if (_issue.format === "ends_with")
              return `Format inv\xE0lid: ha d'acabar amb "${_issue.suffix}"`;
            if (_issue.format === "includes")
              return `Format inv\xE0lid: ha d'incloure "${_issue.includes}"`;
            if (_issue.format === "regex")
              return `Format inv\xE0lid: ha de coincidir amb el patr\xF3 ${_issue.pattern}`;
            return `Format inv\xE0lid per a ${FormatDictionary[_issue.format] ?? issue.format}`;
          }
          case "not_multiple_of":
            return `N\xFAmero inv\xE0lid: ha de ser m\xFAltiple de ${issue.divisor}`;
          case "unrecognized_keys":
            return `Clau${issue.keys.length > 1 ? "s" : ""} no reconeguda${issue.keys.length > 1 ? "s" : ""}: ${util.joinValues(issue.keys, ", ")}`;
          case "invalid_key":
            return `Clau inv\xE0lida a ${issue.origin}`;
          case "invalid_union":
            return "Entrada inv\xE0lida";
          // Could also be "Tipus d'unió invàlid" but "Entrada invàlida" is more general
          case "invalid_element":
            return `Element inv\xE0lid a ${issue.origin}`;
          default:
            return `Entrada inv\xE0lida`;
        }
      };
    }, "error");
    function default_1() {
      return {
        localeError: error()
      };
    }
    __name(default_1, "default_1");
    module2.exports = exports2.default;
  }
});

// node_modules/zod/v4/locales/cs.cjs
var require_cs = __commonJS({
  "node_modules/zod/v4/locales/cs.cjs"(exports2, module2) {
    "use strict";
    var __createBinding = exports2 && exports2.__createBinding || (Object.create ? (function(o, m, k, k2) {
      if (k2 === void 0) k2 = k;
      var desc = Object.getOwnPropertyDescriptor(m, k);
      if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
        desc = { enumerable: true, get: /* @__PURE__ */ __name(function() {
          return m[k];
        }, "get") };
      }
      Object.defineProperty(o, k2, desc);
    }) : (function(o, m, k, k2) {
      if (k2 === void 0) k2 = k;
      o[k2] = m[k];
    }));
    var __setModuleDefault = exports2 && exports2.__setModuleDefault || (Object.create ? (function(o, v) {
      Object.defineProperty(o, "default", { enumerable: true, value: v });
    }) : function(o, v) {
      o["default"] = v;
    });
    var __importStar = exports2 && exports2.__importStar || function(mod) {
      if (mod && mod.__esModule) return mod;
      var result = {};
      if (mod != null) {
        for (var k in mod) if (k !== "default" && Object.prototype.hasOwnProperty.call(mod, k)) __createBinding(result, mod, k);
      }
      __setModuleDefault(result, mod);
      return result;
    };
    Object.defineProperty(exports2, "__esModule", { value: true });
    exports2.default = default_1;
    var util = __importStar(require_util());
    var error = /* @__PURE__ */ __name(() => {
      const Sizable = {
        string: { unit: "znak\u016F", verb: "m\xEDt" },
        file: { unit: "bajt\u016F", verb: "m\xEDt" },
        array: { unit: "prvk\u016F", verb: "m\xEDt" },
        set: { unit: "prvk\u016F", verb: "m\xEDt" }
      };
      function getSizing(origin) {
        return Sizable[origin] ?? null;
      }
      __name(getSizing, "getSizing");
      const FormatDictionary = {
        regex: "regul\xE1rn\xED v\xFDraz",
        email: "e-mailov\xE1 adresa",
        url: "URL",
        emoji: "emoji",
        uuid: "UUID",
        uuidv4: "UUIDv4",
        uuidv6: "UUIDv6",
        nanoid: "nanoid",
        guid: "GUID",
        cuid: "cuid",
        cuid2: "cuid2",
        ulid: "ULID",
        xid: "XID",
        ksuid: "KSUID",
        datetime: "datum a \u010Das ve form\xE1tu ISO",
        date: "datum ve form\xE1tu ISO",
        time: "\u010Das ve form\xE1tu ISO",
        duration: "doba trv\xE1n\xED ISO",
        ipv4: "IPv4 adresa",
        ipv6: "IPv6 adresa",
        cidrv4: "rozsah IPv4",
        cidrv6: "rozsah IPv6",
        base64: "\u0159et\u011Bzec zak\xF3dovan\xFD ve form\xE1tu base64",
        base64url: "\u0159et\u011Bzec zak\xF3dovan\xFD ve form\xE1tu base64url",
        json_string: "\u0159et\u011Bzec ve form\xE1tu JSON",
        e164: "\u010D\xEDslo E.164",
        jwt: "JWT",
        template_literal: "vstup"
      };
      const TypeDictionary = {
        nan: "NaN",
        number: "\u010D\xEDslo",
        string: "\u0159et\u011Bzec",
        function: "funkce",
        array: "pole"
      };
      return (issue) => {
        switch (issue.code) {
          case "invalid_type": {
            const expected = TypeDictionary[issue.expected] ?? issue.expected;
            const receivedType = util.parsedType(issue.input);
            const received = TypeDictionary[receivedType] ?? receivedType;
            if (/^[A-Z]/.test(issue.expected)) {
              return `Neplatn\xFD vstup: o\u010Dek\xE1v\xE1no instanceof ${issue.expected}, obdr\u017Eeno ${received}`;
            }
            return `Neplatn\xFD vstup: o\u010Dek\xE1v\xE1no ${expected}, obdr\u017Eeno ${received}`;
          }
          case "invalid_value":
            if (issue.values.length === 1)
              return `Neplatn\xFD vstup: o\u010Dek\xE1v\xE1no ${util.stringifyPrimitive(issue.values[0])}`;
            return `Neplatn\xE1 mo\u017Enost: o\u010Dek\xE1v\xE1na jedna z hodnot ${util.joinValues(issue.values, "|")}`;
          case "too_big": {
            const adj = issue.inclusive ? "<=" : "<";
            const sizing = getSizing(issue.origin);
            if (sizing) {
              return `Hodnota je p\u0159\xEDli\u0161 velk\xE1: ${issue.origin ?? "hodnota"} mus\xED m\xEDt ${adj}${issue.maximum.toString()} ${sizing.unit ?? "prvk\u016F"}`;
            }
            return `Hodnota je p\u0159\xEDli\u0161 velk\xE1: ${issue.origin ?? "hodnota"} mus\xED b\xFDt ${adj}${issue.maximum.toString()}`;
          }
          case "too_small": {
            const adj = issue.inclusive ? ">=" : ">";
            const sizing = getSizing(issue.origin);
            if (sizing) {
              return `Hodnota je p\u0159\xEDli\u0161 mal\xE1: ${issue.origin ?? "hodnota"} mus\xED m\xEDt ${adj}${issue.minimum.toString()} ${sizing.unit ?? "prvk\u016F"}`;
            }
            return `Hodnota je p\u0159\xEDli\u0161 mal\xE1: ${issue.origin ?? "hodnota"} mus\xED b\xFDt ${adj}${issue.minimum.toString()}`;
          }
          case "invalid_format": {
            const _issue = issue;
            if (_issue.format === "starts_with")
              return `Neplatn\xFD \u0159et\u011Bzec: mus\xED za\u010D\xEDnat na "${_issue.prefix}"`;
            if (_issue.format === "ends_with")
              return `Neplatn\xFD \u0159et\u011Bzec: mus\xED kon\u010Dit na "${_issue.suffix}"`;
            if (_issue.format === "includes")
              return `Neplatn\xFD \u0159et\u011Bzec: mus\xED obsahovat "${_issue.includes}"`;
            if (_issue.format === "regex")
              return `Neplatn\xFD \u0159et\u011Bzec: mus\xED odpov\xEDdat vzoru ${_issue.pattern}`;
            return `Neplatn\xFD form\xE1t ${FormatDictionary[_issue.format] ?? issue.format}`;
          }
          case "not_multiple_of":
            return `Neplatn\xE9 \u010D\xEDslo: mus\xED b\xFDt n\xE1sobkem ${issue.divisor}`;
          case "unrecognized_keys":
            return `Nezn\xE1m\xE9 kl\xED\u010De: ${util.joinValues(issue.keys, ", ")}`;
          case "invalid_key":
            return `Neplatn\xFD kl\xED\u010D v ${issue.origin}`;
          case "invalid_union":
            return "Neplatn\xFD vstup";
          case "invalid_element":
            return `Neplatn\xE1 hodnota v ${issue.origin}`;
          default:
            return `Neplatn\xFD vstup`;
        }
      };
    }, "error");
    function default_1() {
      return {
        localeError: error()
      };
    }
    __name(default_1, "default_1");
    module2.exports = exports2.default;
  }
});

// node_modules/zod/v4/locales/da.cjs
var require_da = __commonJS({
  "node_modules/zod/v4/locales/da.cjs"(exports2, module2) {
    "use strict";
    var __createBinding = exports2 && exports2.__createBinding || (Object.create ? (function(o, m, k, k2) {
      if (k2 === void 0) k2 = k;
      var desc = Object.getOwnPropertyDescriptor(m, k);
      if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
        desc = { enumerable: true, get: /* @__PURE__ */ __name(function() {
          return m[k];
        }, "get") };
      }
      Object.defineProperty(o, k2, desc);
    }) : (function(o, m, k, k2) {
      if (k2 === void 0) k2 = k;
      o[k2] = m[k];
    }));
    var __setModuleDefault = exports2 && exports2.__setModuleDefault || (Object.create ? (function(o, v) {
      Object.defineProperty(o, "default", { enumerable: true, value: v });
    }) : function(o, v) {
      o["default"] = v;
    });
    var __importStar = exports2 && exports2.__importStar || function(mod) {
      if (mod && mod.__esModule) return mod;
      var result = {};
      if (mod != null) {
        for (var k in mod) if (k !== "default" && Object.prototype.hasOwnProperty.call(mod, k)) __createBinding(result, mod, k);
      }
      __setModuleDefault(result, mod);
      return result;
    };
    Object.defineProperty(exports2, "__esModule", { value: true });
    exports2.default = default_1;
    var util = __importStar(require_util());
    var error = /* @__PURE__ */ __name(() => {
      const Sizable = {
        string: { unit: "tegn", verb: "havde" },
        file: { unit: "bytes", verb: "havde" },
        array: { unit: "elementer", verb: "indeholdt" },
        set: { unit: "elementer", verb: "indeholdt" }
      };
      function getSizing(origin) {
        return Sizable[origin] ?? null;
      }
      __name(getSizing, "getSizing");
      const FormatDictionary = {
        regex: "input",
        email: "e-mailadresse",
        url: "URL",
        emoji: "emoji",
        uuid: "UUID",
        uuidv4: "UUIDv4",
        uuidv6: "UUIDv6",
        nanoid: "nanoid",
        guid: "GUID",
        cuid: "cuid",
        cuid2: "cuid2",
        ulid: "ULID",
        xid: "XID",
        ksuid: "KSUID",
        datetime: "ISO dato- og klokkesl\xE6t",
        date: "ISO-dato",
        time: "ISO-klokkesl\xE6t",
        duration: "ISO-varighed",
        ipv4: "IPv4-omr\xE5de",
        ipv6: "IPv6-omr\xE5de",
        cidrv4: "IPv4-spektrum",
        cidrv6: "IPv6-spektrum",
        base64: "base64-kodet streng",
        base64url: "base64url-kodet streng",
        json_string: "JSON-streng",
        e164: "E.164-nummer",
        jwt: "JWT",
        template_literal: "input"
      };
      const TypeDictionary = {
        nan: "NaN",
        string: "streng",
        number: "tal",
        boolean: "boolean",
        array: "liste",
        object: "objekt",
        set: "s\xE6t",
        file: "fil"
      };
      return (issue) => {
        switch (issue.code) {
          case "invalid_type": {
            const expected = TypeDictionary[issue.expected] ?? issue.expected;
            const receivedType = util.parsedType(issue.input);
            const received = TypeDictionary[receivedType] ?? receivedType;
            if (/^[A-Z]/.test(issue.expected)) {
              return `Ugyldigt input: forventede instanceof ${issue.expected}, fik ${received}`;
            }
            return `Ugyldigt input: forventede ${expected}, fik ${received}`;
          }
          case "invalid_value":
            if (issue.values.length === 1)
              return `Ugyldig v\xE6rdi: forventede ${util.stringifyPrimitive(issue.values[0])}`;
            return `Ugyldigt valg: forventede en af f\xF8lgende ${util.joinValues(issue.values, "|")}`;
          case "too_big": {
            const adj = issue.inclusive ? "<=" : "<";
            const sizing = getSizing(issue.origin);
            const origin = TypeDictionary[issue.origin] ?? issue.origin;
            if (sizing)
              return `For stor: forventede ${origin ?? "value"} ${sizing.verb} ${adj} ${issue.maximum.toString()} ${sizing.unit ?? "elementer"}`;
            return `For stor: forventede ${origin ?? "value"} havde ${adj} ${issue.maximum.toString()}`;
          }
          case "too_small": {
            const adj = issue.inclusive ? ">=" : ">";
            const sizing = getSizing(issue.origin);
            const origin = TypeDictionary[issue.origin] ?? issue.origin;
            if (sizing) {
              return `For lille: forventede ${origin} ${sizing.verb} ${adj} ${issue.minimum.toString()} ${sizing.unit}`;
            }
            return `For lille: forventede ${origin} havde ${adj} ${issue.minimum.toString()}`;
          }
          case "invalid_format": {
            const _issue = issue;
            if (_issue.format === "starts_with")
              return `Ugyldig streng: skal starte med "${_issue.prefix}"`;
            if (_issue.format === "ends_with")
              return `Ugyldig streng: skal ende med "${_issue.suffix}"`;
            if (_issue.format === "includes")
              return `Ugyldig streng: skal indeholde "${_issue.includes}"`;
            if (_issue.format === "regex")
              return `Ugyldig streng: skal matche m\xF8nsteret ${_issue.pattern}`;
            return `Ugyldig ${FormatDictionary[_issue.format] ?? issue.format}`;
          }
          case "not_multiple_of":
            return `Ugyldigt tal: skal v\xE6re deleligt med ${issue.divisor}`;
          case "unrecognized_keys":
            return `${issue.keys.length > 1 ? "Ukendte n\xF8gler" : "Ukendt n\xF8gle"}: ${util.joinValues(issue.keys, ", ")}`;
          case "invalid_key":
            return `Ugyldig n\xF8gle i ${issue.origin}`;
          case "invalid_union":
            return "Ugyldigt input: matcher ingen af de tilladte typer";
          case "invalid_element":
            return `Ugyldig v\xE6rdi i ${issue.origin}`;
          default:
            return `Ugyldigt input`;
        }
      };
    }, "error");
    function default_1() {
      return {
        localeError: error()
      };
    }
    __name(default_1, "default_1");
    module2.exports = exports2.default;
  }
});

// node_modules/zod/v4/locales/de.cjs
var require_de = __commonJS({
  "node_modules/zod/v4/locales/de.cjs"(exports2, module2) {
    "use strict";
    var __createBinding = exports2 && exports2.__createBinding || (Object.create ? (function(o, m, k, k2) {
      if (k2 === void 0) k2 = k;
      var desc = Object.getOwnPropertyDescriptor(m, k);
      if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
        desc = { enumerable: true, get: /* @__PURE__ */ __name(function() {
          return m[k];
        }, "get") };
      }
      Object.defineProperty(o, k2, desc);
    }) : (function(o, m, k, k2) {
      if (k2 === void 0) k2 = k;
      o[k2] = m[k];
    }));
    var __setModuleDefault = exports2 && exports2.__setModuleDefault || (Object.create ? (function(o, v) {
      Object.defineProperty(o, "default", { enumerable: true, value: v });
    }) : function(o, v) {
      o["default"] = v;
    });
    var __importStar = exports2 && exports2.__importStar || function(mod) {
      if (mod && mod.__esModule) return mod;
      var result = {};
      if (mod != null) {
        for (var k in mod) if (k !== "default" && Object.prototype.hasOwnProperty.call(mod, k)) __createBinding(result, mod, k);
      }
      __setModuleDefault(result, mod);
      return result;
    };
    Object.defineProperty(exports2, "__esModule", { value: true });
    exports2.default = default_1;
    var util = __importStar(require_util());
    var error = /* @__PURE__ */ __name(() => {
      const Sizable = {
        string: { unit: "Zeichen", verb: "zu haben" },
        file: { unit: "Bytes", verb: "zu haben" },
        array: { unit: "Elemente", verb: "zu haben" },
        set: { unit: "Elemente", verb: "zu haben" }
      };
      function getSizing(origin) {
        return Sizable[origin] ?? null;
      }
      __name(getSizing, "getSizing");
      const FormatDictionary = {
        regex: "Eingabe",
        email: "E-Mail-Adresse",
        url: "URL",
        emoji: "Emoji",
        uuid: "UUID",
        uuidv4: "UUIDv4",
        uuidv6: "UUIDv6",
        nanoid: "nanoid",
        guid: "GUID",
        cuid: "cuid",
        cuid2: "cuid2",
        ulid: "ULID",
        xid: "XID",
        ksuid: "KSUID",
        datetime: "ISO-Datum und -Uhrzeit",
        date: "ISO-Datum",
        time: "ISO-Uhrzeit",
        duration: "ISO-Dauer",
        ipv4: "IPv4-Adresse",
        ipv6: "IPv6-Adresse",
        cidrv4: "IPv4-Bereich",
        cidrv6: "IPv6-Bereich",
        base64: "Base64-codierter String",
        base64url: "Base64-URL-codierter String",
        json_string: "JSON-String",
        e164: "E.164-Nummer",
        jwt: "JWT",
        template_literal: "Eingabe"
      };
      const TypeDictionary = {
        nan: "NaN",
        number: "Zahl",
        array: "Array"
      };
      return (issue) => {
        switch (issue.code) {
          case "invalid_type": {
            const expected = TypeDictionary[issue.expected] ?? issue.expected;
            const receivedType = util.parsedType(issue.input);
            const received = TypeDictionary[receivedType] ?? receivedType;
            if (/^[A-Z]/.test(issue.expected)) {
              return `Ung\xFCltige Eingabe: erwartet instanceof ${issue.expected}, erhalten ${received}`;
            }
            return `Ung\xFCltige Eingabe: erwartet ${expected}, erhalten ${received}`;
          }
          case "invalid_value":
            if (issue.values.length === 1)
              return `Ung\xFCltige Eingabe: erwartet ${util.stringifyPrimitive(issue.values[0])}`;
            return `Ung\xFCltige Option: erwartet eine von ${util.joinValues(issue.values, "|")}`;
          case "too_big": {
            const adj = issue.inclusive ? "<=" : "<";
            const sizing = getSizing(issue.origin);
            if (sizing)
              return `Zu gro\xDF: erwartet, dass ${issue.origin ?? "Wert"} ${adj}${issue.maximum.toString()} ${sizing.unit ?? "Elemente"} hat`;
            return `Zu gro\xDF: erwartet, dass ${issue.origin ?? "Wert"} ${adj}${issue.maximum.toString()} ist`;
          }
          case "too_small": {
            const adj = issue.inclusive ? ">=" : ">";
            const sizing = getSizing(issue.origin);
            if (sizing) {
              return `Zu klein: erwartet, dass ${issue.origin} ${adj}${issue.minimum.toString()} ${sizing.unit} hat`;
            }
            return `Zu klein: erwartet, dass ${issue.origin} ${adj}${issue.minimum.toString()} ist`;
          }
          case "invalid_format": {
            const _issue = issue;
            if (_issue.format === "starts_with")
              return `Ung\xFCltiger String: muss mit "${_issue.prefix}" beginnen`;
            if (_issue.format === "ends_with")
              return `Ung\xFCltiger String: muss mit "${_issue.suffix}" enden`;
            if (_issue.format === "includes")
              return `Ung\xFCltiger String: muss "${_issue.includes}" enthalten`;
            if (_issue.format === "regex")
              return `Ung\xFCltiger String: muss dem Muster ${_issue.pattern} entsprechen`;
            return `Ung\xFCltig: ${FormatDictionary[_issue.format] ?? issue.format}`;
          }
          case "not_multiple_of":
            return `Ung\xFCltige Zahl: muss ein Vielfaches von ${issue.divisor} sein`;
          case "unrecognized_keys":
            return `${issue.keys.length > 1 ? "Unbekannte Schl\xFCssel" : "Unbekannter Schl\xFCssel"}: ${util.joinValues(issue.keys, ", ")}`;
          case "invalid_key":
            return `Ung\xFCltiger Schl\xFCssel in ${issue.origin}`;
          case "invalid_union":
            return "Ung\xFCltige Eingabe";
          case "invalid_element":
            return `Ung\xFCltiger Wert in ${issue.origin}`;
          default:
            return `Ung\xFCltige Eingabe`;
        }
      };
    }, "error");
    function default_1() {
      return {
        localeError: error()
      };
    }
    __name(default_1, "default_1");
    module2.exports = exports2.default;
  }
});

// node_modules/zod/v4/locales/en.cjs
var require_en = __commonJS({
  "node_modules/zod/v4/locales/en.cjs"(exports2, module2) {
    "use strict";
    var __createBinding = exports2 && exports2.__createBinding || (Object.create ? (function(o, m, k, k2) {
      if (k2 === void 0) k2 = k;
      var desc = Object.getOwnPropertyDescriptor(m, k);
      if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
        desc = { enumerable: true, get: /* @__PURE__ */ __name(function() {
          return m[k];
        }, "get") };
      }
      Object.defineProperty(o, k2, desc);
    }) : (function(o, m, k, k2) {
      if (k2 === void 0) k2 = k;
      o[k2] = m[k];
    }));
    var __setModuleDefault = exports2 && exports2.__setModuleDefault || (Object.create ? (function(o, v) {
      Object.defineProperty(o, "default", { enumerable: true, value: v });
    }) : function(o, v) {
      o["default"] = v;
    });
    var __importStar = exports2 && exports2.__importStar || function(mod) {
      if (mod && mod.__esModule) return mod;
      var result = {};
      if (mod != null) {
        for (var k in mod) if (k !== "default" && Object.prototype.hasOwnProperty.call(mod, k)) __createBinding(result, mod, k);
      }
      __setModuleDefault(result, mod);
      return result;
    };
    Object.defineProperty(exports2, "__esModule", { value: true });
    exports2.default = default_1;
    var util = __importStar(require_util());
    var error = /* @__PURE__ */ __name(() => {
      const Sizable = {
        string: { unit: "characters", verb: "to have" },
        file: { unit: "bytes", verb: "to have" },
        array: { unit: "items", verb: "to have" },
        set: { unit: "items", verb: "to have" },
        map: { unit: "entries", verb: "to have" }
      };
      function getSizing(origin) {
        return Sizable[origin] ?? null;
      }
      __name(getSizing, "getSizing");
      const FormatDictionary = {
        regex: "input",
        email: "email address",
        url: "URL",
        emoji: "emoji",
        uuid: "UUID",
        uuidv4: "UUIDv4",
        uuidv6: "UUIDv6",
        nanoid: "nanoid",
        guid: "GUID",
        cuid: "cuid",
        cuid2: "cuid2",
        ulid: "ULID",
        xid: "XID",
        ksuid: "KSUID",
        datetime: "ISO datetime",
        date: "ISO date",
        time: "ISO time",
        duration: "ISO duration",
        ipv4: "IPv4 address",
        ipv6: "IPv6 address",
        mac: "MAC address",
        cidrv4: "IPv4 range",
        cidrv6: "IPv6 range",
        base64: "base64-encoded string",
        base64url: "base64url-encoded string",
        json_string: "JSON string",
        e164: "E.164 number",
        jwt: "JWT",
        template_literal: "input"
      };
      const TypeDictionary = {
        // Compatibility: "nan" -> "NaN" for display
        nan: "NaN"
        // All other type names omitted - they fall back to raw values via ?? operator
      };
      return (issue) => {
        switch (issue.code) {
          case "invalid_type": {
            const expected = TypeDictionary[issue.expected] ?? issue.expected;
            const receivedType = util.parsedType(issue.input);
            const received = TypeDictionary[receivedType] ?? receivedType;
            return `Invalid input: expected ${expected}, received ${received}`;
          }
          case "invalid_value":
            if (issue.values.length === 1)
              return `Invalid input: expected ${util.stringifyPrimitive(issue.values[0])}`;
            return `Invalid option: expected one of ${util.joinValues(issue.values, "|")}`;
          case "too_big": {
            const adj = issue.inclusive ? "<=" : "<";
            const sizing = getSizing(issue.origin);
            if (sizing)
              return `Too big: expected ${issue.origin ?? "value"} to have ${adj}${issue.maximum.toString()} ${sizing.unit ?? "elements"}`;
            return `Too big: expected ${issue.origin ?? "value"} to be ${adj}${issue.maximum.toString()}`;
          }
          case "too_small": {
            const adj = issue.inclusive ? ">=" : ">";
            const sizing = getSizing(issue.origin);
            if (sizing) {
              return `Too small: expected ${issue.origin} to have ${adj}${issue.minimum.toString()} ${sizing.unit}`;
            }
            return `Too small: expected ${issue.origin} to be ${adj}${issue.minimum.toString()}`;
          }
          case "invalid_format": {
            const _issue = issue;
            if (_issue.format === "starts_with") {
              return `Invalid string: must start with "${_issue.prefix}"`;
            }
            if (_issue.format === "ends_with")
              return `Invalid string: must end with "${_issue.suffix}"`;
            if (_issue.format === "includes")
              return `Invalid string: must include "${_issue.includes}"`;
            if (_issue.format === "regex")
              return `Invalid string: must match pattern ${_issue.pattern}`;
            return `Invalid ${FormatDictionary[_issue.format] ?? issue.format}`;
          }
          case "not_multiple_of":
            return `Invalid number: must be a multiple of ${issue.divisor}`;
          case "unrecognized_keys":
            return `Unrecognized key${issue.keys.length > 1 ? "s" : ""}: ${util.joinValues(issue.keys, ", ")}`;
          case "invalid_key":
            return `Invalid key in ${issue.origin}`;
          case "invalid_union":
            return "Invalid input";
          case "invalid_element":
            return `Invalid value in ${issue.origin}`;
          default:
            return `Invalid input`;
        }
      };
    }, "error");
    function default_1() {
      return {
        localeError: error()
      };
    }
    __name(default_1, "default_1");
    module2.exports = exports2.default;
  }
});

// node_modules/zod/v4/locales/eo.cjs
var require_eo = __commonJS({
  "node_modules/zod/v4/locales/eo.cjs"(exports2, module2) {
    "use strict";
    var __createBinding = exports2 && exports2.__createBinding || (Object.create ? (function(o, m, k, k2) {
      if (k2 === void 0) k2 = k;
      var desc = Object.getOwnPropertyDescriptor(m, k);
      if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
        desc = { enumerable: true, get: /* @__PURE__ */ __name(function() {
          return m[k];
        }, "get") };
      }
      Object.defineProperty(o, k2, desc);
    }) : (function(o, m, k, k2) {
      if (k2 === void 0) k2 = k;
      o[k2] = m[k];
    }));
    var __setModuleDefault = exports2 && exports2.__setModuleDefault || (Object.create ? (function(o, v) {
      Object.defineProperty(o, "default", { enumerable: true, value: v });
    }) : function(o, v) {
      o["default"] = v;
    });
    var __importStar = exports2 && exports2.__importStar || function(mod) {
      if (mod && mod.__esModule) return mod;
      var result = {};
      if (mod != null) {
        for (var k in mod) if (k !== "default" && Object.prototype.hasOwnProperty.call(mod, k)) __createBinding(result, mod, k);
      }
      __setModuleDefault(result, mod);
      return result;
    };
    Object.defineProperty(exports2, "__esModule", { value: true });
    exports2.default = default_1;
    var util = __importStar(require_util());
    var error = /* @__PURE__ */ __name(() => {
      const Sizable = {
        string: { unit: "karaktrojn", verb: "havi" },
        file: { unit: "bajtojn", verb: "havi" },
        array: { unit: "elementojn", verb: "havi" },
        set: { unit: "elementojn", verb: "havi" }
      };
      function getSizing(origin) {
        return Sizable[origin] ?? null;
      }
      __name(getSizing, "getSizing");
      const FormatDictionary = {
        regex: "enigo",
        email: "retadreso",
        url: "URL",
        emoji: "emo\u011Dio",
        uuid: "UUID",
        uuidv4: "UUIDv4",
        uuidv6: "UUIDv6",
        nanoid: "nanoid",
        guid: "GUID",
        cuid: "cuid",
        cuid2: "cuid2",
        ulid: "ULID",
        xid: "XID",
        ksuid: "KSUID",
        datetime: "ISO-datotempo",
        date: "ISO-dato",
        time: "ISO-tempo",
        duration: "ISO-da\u016Dro",
        ipv4: "IPv4-adreso",
        ipv6: "IPv6-adreso",
        cidrv4: "IPv4-rango",
        cidrv6: "IPv6-rango",
        base64: "64-ume kodita karaktraro",
        base64url: "URL-64-ume kodita karaktraro",
        json_string: "JSON-karaktraro",
        e164: "E.164-nombro",
        jwt: "JWT",
        template_literal: "enigo"
      };
      const TypeDictionary = {
        nan: "NaN",
        number: "nombro",
        array: "tabelo",
        null: "senvalora"
      };
      return (issue) => {
        switch (issue.code) {
          case "invalid_type": {
            const expected = TypeDictionary[issue.expected] ?? issue.expected;
            const receivedType = util.parsedType(issue.input);
            const received = TypeDictionary[receivedType] ?? receivedType;
            if (/^[A-Z]/.test(issue.expected)) {
              return `Nevalida enigo: atendi\u011Dis instanceof ${issue.expected}, ricevi\u011Dis ${received}`;
            }
            return `Nevalida enigo: atendi\u011Dis ${expected}, ricevi\u011Dis ${received}`;
          }
          case "invalid_value":
            if (issue.values.length === 1)
              return `Nevalida enigo: atendi\u011Dis ${util.stringifyPrimitive(issue.values[0])}`;
            return `Nevalida opcio: atendi\u011Dis unu el ${util.joinValues(issue.values, "|")}`;
          case "too_big": {
            const adj = issue.inclusive ? "<=" : "<";
            const sizing = getSizing(issue.origin);
            if (sizing)
              return `Tro granda: atendi\u011Dis ke ${issue.origin ?? "valoro"} havu ${adj}${issue.maximum.toString()} ${sizing.unit ?? "elementojn"}`;
            return `Tro granda: atendi\u011Dis ke ${issue.origin ?? "valoro"} havu ${adj}${issue.maximum.toString()}`;
          }
          case "too_small": {
            const adj = issue.inclusive ? ">=" : ">";
            const sizing = getSizing(issue.origin);
            if (sizing) {
              return `Tro malgranda: atendi\u011Dis ke ${issue.origin} havu ${adj}${issue.minimum.toString()} ${sizing.unit}`;
            }
            return `Tro malgranda: atendi\u011Dis ke ${issue.origin} estu ${adj}${issue.minimum.toString()}`;
          }
          case "invalid_format": {
            const _issue = issue;
            if (_issue.format === "starts_with")
              return `Nevalida karaktraro: devas komenci\u011Di per "${_issue.prefix}"`;
            if (_issue.format === "ends_with")
              return `Nevalida karaktraro: devas fini\u011Di per "${_issue.suffix}"`;
            if (_issue.format === "includes")
              return `Nevalida karaktraro: devas inkluzivi "${_issue.includes}"`;
            if (_issue.format === "regex")
              return `Nevalida karaktraro: devas kongrui kun la modelo ${_issue.pattern}`;
            return `Nevalida ${FormatDictionary[_issue.format] ?? issue.format}`;
          }
          case "not_multiple_of":
            return `Nevalida nombro: devas esti oblo de ${issue.divisor}`;
          case "unrecognized_keys":
            return `Nekonata${issue.keys.length > 1 ? "j" : ""} \u015Dlosilo${issue.keys.length > 1 ? "j" : ""}: ${util.joinValues(issue.keys, ", ")}`;
          case "invalid_key":
            return `Nevalida \u015Dlosilo en ${issue.origin}`;
          case "invalid_union":
            return "Nevalida enigo";
          case "invalid_element":
            return `Nevalida valoro en ${issue.origin}`;
          default:
            return `Nevalida enigo`;
        }
      };
    }, "error");
    function default_1() {
      return {
        localeError: error()
      };
    }
    __name(default_1, "default_1");
    module2.exports = exports2.default;
  }
});

// node_modules/zod/v4/locales/es.cjs
var require_es = __commonJS({
  "node_modules/zod/v4/locales/es.cjs"(exports2, module2) {
    "use strict";
    var __createBinding = exports2 && exports2.__createBinding || (Object.create ? (function(o, m, k, k2) {
      if (k2 === void 0) k2 = k;
      var desc = Object.getOwnPropertyDescriptor(m, k);
      if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
        desc = { enumerable: true, get: /* @__PURE__ */ __name(function() {
          return m[k];
        }, "get") };
      }
      Object.defineProperty(o, k2, desc);
    }) : (function(o, m, k, k2) {
      if (k2 === void 0) k2 = k;
      o[k2] = m[k];
    }));
    var __setModuleDefault = exports2 && exports2.__setModuleDefault || (Object.create ? (function(o, v) {
      Object.defineProperty(o, "default", { enumerable: true, value: v });
    }) : function(o, v) {
      o["default"] = v;
    });
    var __importStar = exports2 && exports2.__importStar || function(mod) {
      if (mod && mod.__esModule) return mod;
      var result = {};
      if (mod != null) {
        for (var k in mod) if (k !== "default" && Object.prototype.hasOwnProperty.call(mod, k)) __createBinding(result, mod, k);
      }
      __setModuleDefault(result, mod);
      return result;
    };
    Object.defineProperty(exports2, "__esModule", { value: true });
    exports2.default = default_1;
    var util = __importStar(require_util());
    var error = /* @__PURE__ */ __name(() => {
      const Sizable = {
        string: { unit: "caracteres", verb: "tener" },
        file: { unit: "bytes", verb: "tener" },
        array: { unit: "elementos", verb: "tener" },
        set: { unit: "elementos", verb: "tener" }
      };
      function getSizing(origin) {
        return Sizable[origin] ?? null;
      }
      __name(getSizing, "getSizing");
      const FormatDictionary = {
        regex: "entrada",
        email: "direcci\xF3n de correo electr\xF3nico",
        url: "URL",
        emoji: "emoji",
        uuid: "UUID",
        uuidv4: "UUIDv4",
        uuidv6: "UUIDv6",
        nanoid: "nanoid",
        guid: "GUID",
        cuid: "cuid",
        cuid2: "cuid2",
        ulid: "ULID",
        xid: "XID",
        ksuid: "KSUID",
        datetime: "fecha y hora ISO",
        date: "fecha ISO",
        time: "hora ISO",
        duration: "duraci\xF3n ISO",
        ipv4: "direcci\xF3n IPv4",
        ipv6: "direcci\xF3n IPv6",
        cidrv4: "rango IPv4",
        cidrv6: "rango IPv6",
        base64: "cadena codificada en base64",
        base64url: "URL codificada en base64",
        json_string: "cadena JSON",
        e164: "n\xFAmero E.164",
        jwt: "JWT",
        template_literal: "entrada"
      };
      const TypeDictionary = {
        nan: "NaN",
        string: "texto",
        number: "n\xFAmero",
        boolean: "booleano",
        array: "arreglo",
        object: "objeto",
        set: "conjunto",
        file: "archivo",
        date: "fecha",
        bigint: "n\xFAmero grande",
        symbol: "s\xEDmbolo",
        undefined: "indefinido",
        null: "nulo",
        function: "funci\xF3n",
        map: "mapa",
        record: "registro",
        tuple: "tupla",
        enum: "enumeraci\xF3n",
        union: "uni\xF3n",
        literal: "literal",
        promise: "promesa",
        void: "vac\xEDo",
        never: "nunca",
        unknown: "desconocido",
        any: "cualquiera"
      };
      return (issue) => {
        switch (issue.code) {
          case "invalid_type": {
            const expected = TypeDictionary[issue.expected] ?? issue.expected;
            const receivedType = util.parsedType(issue.input);
            const received = TypeDictionary[receivedType] ?? receivedType;
            if (/^[A-Z]/.test(issue.expected)) {
              return `Entrada inv\xE1lida: se esperaba instanceof ${issue.expected}, recibido ${received}`;
            }
            return `Entrada inv\xE1lida: se esperaba ${expected}, recibido ${received}`;
          }
          case "invalid_value":
            if (issue.values.length === 1)
              return `Entrada inv\xE1lida: se esperaba ${util.stringifyPrimitive(issue.values[0])}`;
            return `Opci\xF3n inv\xE1lida: se esperaba una de ${util.joinValues(issue.values, "|")}`;
          case "too_big": {
            const adj = issue.inclusive ? "<=" : "<";
            const sizing = getSizing(issue.origin);
            const origin = TypeDictionary[issue.origin] ?? issue.origin;
            if (sizing)
              return `Demasiado grande: se esperaba que ${origin ?? "valor"} tuviera ${adj}${issue.maximum.toString()} ${sizing.unit ?? "elementos"}`;
            return `Demasiado grande: se esperaba que ${origin ?? "valor"} fuera ${adj}${issue.maximum.toString()}`;
          }
          case "too_small": {
            const adj = issue.inclusive ? ">=" : ">";
            const sizing = getSizing(issue.origin);
            const origin = TypeDictionary[issue.origin] ?? issue.origin;
            if (sizing) {
              return `Demasiado peque\xF1o: se esperaba que ${origin} tuviera ${adj}${issue.minimum.toString()} ${sizing.unit}`;
            }
            return `Demasiado peque\xF1o: se esperaba que ${origin} fuera ${adj}${issue.minimum.toString()}`;
          }
          case "invalid_format": {
            const _issue = issue;
            if (_issue.format === "starts_with")
              return `Cadena inv\xE1lida: debe comenzar con "${_issue.prefix}"`;
            if (_issue.format === "ends_with")
              return `Cadena inv\xE1lida: debe terminar en "${_issue.suffix}"`;
            if (_issue.format === "includes")
              return `Cadena inv\xE1lida: debe incluir "${_issue.includes}"`;
            if (_issue.format === "regex")
              return `Cadena inv\xE1lida: debe coincidir con el patr\xF3n ${_issue.pattern}`;
            return `Inv\xE1lido ${FormatDictionary[_issue.format] ?? issue.format}`;
          }
          case "not_multiple_of":
            return `N\xFAmero inv\xE1lido: debe ser m\xFAltiplo de ${issue.divisor}`;
          case "unrecognized_keys":
            return `Llave${issue.keys.length > 1 ? "s" : ""} desconocida${issue.keys.length > 1 ? "s" : ""}: ${util.joinValues(issue.keys, ", ")}`;
          case "invalid_key":
            return `Llave inv\xE1lida en ${TypeDictionary[issue.origin] ?? issue.origin}`;
          case "invalid_union":
            return "Entrada inv\xE1lida";
          case "invalid_element":
            return `Valor inv\xE1lido en ${TypeDictionary[issue.origin] ?? issue.origin}`;
          default:
            return `Entrada inv\xE1lida`;
        }
      };
    }, "error");
    function default_1() {
      return {
        localeError: error()
      };
    }
    __name(default_1, "default_1");
    module2.exports = exports2.default;
  }
});

// node_modules/zod/v4/locales/fa.cjs
var require_fa = __commonJS({
  "node_modules/zod/v4/locales/fa.cjs"(exports2, module2) {
    "use strict";
    var __createBinding = exports2 && exports2.__createBinding || (Object.create ? (function(o, m, k, k2) {
      if (k2 === void 0) k2 = k;
      var desc = Object.getOwnPropertyDescriptor(m, k);
      if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
        desc = { enumerable: true, get: /* @__PURE__ */ __name(function() {
          return m[k];
        }, "get") };
      }
      Object.defineProperty(o, k2, desc);
    }) : (function(o, m, k, k2) {
      if (k2 === void 0) k2 = k;
      o[k2] = m[k];
    }));
    var __setModuleDefault = exports2 && exports2.__setModuleDefault || (Object.create ? (function(o, v) {
      Object.defineProperty(o, "default", { enumerable: true, value: v });
    }) : function(o, v) {
      o["default"] = v;
    });
    var __importStar = exports2 && exports2.__importStar || function(mod) {
      if (mod && mod.__esModule) return mod;
      var result = {};
      if (mod != null) {
        for (var k in mod) if (k !== "default" && Object.prototype.hasOwnProperty.call(mod, k)) __createBinding(result, mod, k);
      }
      __setModuleDefault(result, mod);
      return result;
    };
    Object.defineProperty(exports2, "__esModule", { value: true });
    exports2.default = default_1;
    var util = __importStar(require_util());
    var error = /* @__PURE__ */ __name(() => {
      const Sizable = {
        string: { unit: "\u06A9\u0627\u0631\u0627\u06A9\u062A\u0631", verb: "\u062F\u0627\u0634\u062A\u0647 \u0628\u0627\u0634\u062F" },
        file: { unit: "\u0628\u0627\u06CC\u062A", verb: "\u062F\u0627\u0634\u062A\u0647 \u0628\u0627\u0634\u062F" },
        array: { unit: "\u0622\u06CC\u062A\u0645", verb: "\u062F\u0627\u0634\u062A\u0647 \u0628\u0627\u0634\u062F" },
        set: { unit: "\u0622\u06CC\u062A\u0645", verb: "\u062F\u0627\u0634\u062A\u0647 \u0628\u0627\u0634\u062F" }
      };
      function getSizing(origin) {
        return Sizable[origin] ?? null;
      }
      __name(getSizing, "getSizing");
      const FormatDictionary = {
        regex: "\u0648\u0631\u0648\u062F\u06CC",
        email: "\u0622\u062F\u0631\u0633 \u0627\u06CC\u0645\u06CC\u0644",
        url: "URL",
        emoji: "\u0627\u06CC\u0645\u0648\u062C\u06CC",
        uuid: "UUID",
        uuidv4: "UUIDv4",
        uuidv6: "UUIDv6",
        nanoid: "nanoid",
        guid: "GUID",
        cuid: "cuid",
        cuid2: "cuid2",
        ulid: "ULID",
        xid: "XID",
        ksuid: "KSUID",
        datetime: "\u062A\u0627\u0631\u06CC\u062E \u0648 \u0632\u0645\u0627\u0646 \u0627\u06CC\u0632\u0648",
        date: "\u062A\u0627\u0631\u06CC\u062E \u0627\u06CC\u0632\u0648",
        time: "\u0632\u0645\u0627\u0646 \u0627\u06CC\u0632\u0648",
        duration: "\u0645\u062F\u062A \u0632\u0645\u0627\u0646 \u0627\u06CC\u0632\u0648",
        ipv4: "IPv4 \u0622\u062F\u0631\u0633",
        ipv6: "IPv6 \u0622\u062F\u0631\u0633",
        cidrv4: "IPv4 \u062F\u0627\u0645\u0646\u0647",
        cidrv6: "IPv6 \u062F\u0627\u0645\u0646\u0647",
        base64: "base64-encoded \u0631\u0634\u062A\u0647",
        base64url: "base64url-encoded \u0631\u0634\u062A\u0647",
        json_string: "JSON \u0631\u0634\u062A\u0647",
        e164: "E.164 \u0639\u062F\u062F",
        jwt: "JWT",
        template_literal: "\u0648\u0631\u0648\u062F\u06CC"
      };
      const TypeDictionary = {
        nan: "NaN",
        number: "\u0639\u062F\u062F",
        array: "\u0622\u0631\u0627\u06CC\u0647"
      };
      return (issue) => {
        switch (issue.code) {
          case "invalid_type": {
            const expected = TypeDictionary[issue.expected] ?? issue.expected;
            const receivedType = util.parsedType(issue.input);
            const received = TypeDictionary[receivedType] ?? receivedType;
            if (/^[A-Z]/.test(issue.expected)) {
              return `\u0648\u0631\u0648\u062F\u06CC \u0646\u0627\u0645\u0639\u062A\u0628\u0631: \u0645\u06CC\u200C\u0628\u0627\u06CC\u0633\u062A instanceof ${issue.expected} \u0645\u06CC\u200C\u0628\u0648\u062F\u060C ${received} \u062F\u0631\u06CC\u0627\u0641\u062A \u0634\u062F`;
            }
            return `\u0648\u0631\u0648\u062F\u06CC \u0646\u0627\u0645\u0639\u062A\u0628\u0631: \u0645\u06CC\u200C\u0628\u0627\u06CC\u0633\u062A ${expected} \u0645\u06CC\u200C\u0628\u0648\u062F\u060C ${received} \u062F\u0631\u06CC\u0627\u0641\u062A \u0634\u062F`;
          }
          case "invalid_value":
            if (issue.values.length === 1) {
              return `\u0648\u0631\u0648\u062F\u06CC \u0646\u0627\u0645\u0639\u062A\u0628\u0631: \u0645\u06CC\u200C\u0628\u0627\u06CC\u0633\u062A ${util.stringifyPrimitive(issue.values[0])} \u0645\u06CC\u200C\u0628\u0648\u062F`;
            }
            return `\u06AF\u0632\u06CC\u0646\u0647 \u0646\u0627\u0645\u0639\u062A\u0628\u0631: \u0645\u06CC\u200C\u0628\u0627\u06CC\u0633\u062A \u06CC\u06A9\u06CC \u0627\u0632 ${util.joinValues(issue.values, "|")} \u0645\u06CC\u200C\u0628\u0648\u062F`;
          case "too_big": {
            const adj = issue.inclusive ? "<=" : "<";
            const sizing = getSizing(issue.origin);
            if (sizing) {
              return `\u062E\u06CC\u0644\u06CC \u0628\u0632\u0631\u06AF: ${issue.origin ?? "\u0645\u0642\u062F\u0627\u0631"} \u0628\u0627\u06CC\u062F ${adj}${issue.maximum.toString()} ${sizing.unit ?? "\u0639\u0646\u0635\u0631"} \u0628\u0627\u0634\u062F`;
            }
            return `\u062E\u06CC\u0644\u06CC \u0628\u0632\u0631\u06AF: ${issue.origin ?? "\u0645\u0642\u062F\u0627\u0631"} \u0628\u0627\u06CC\u062F ${adj}${issue.maximum.toString()} \u0628\u0627\u0634\u062F`;
          }
          case "too_small": {
            const adj = issue.inclusive ? ">=" : ">";
            const sizing = getSizing(issue.origin);
            if (sizing) {
              return `\u062E\u06CC\u0644\u06CC \u06A9\u0648\u0686\u06A9: ${issue.origin} \u0628\u0627\u06CC\u062F ${adj}${issue.minimum.toString()} ${sizing.unit} \u0628\u0627\u0634\u062F`;
            }
            return `\u062E\u06CC\u0644\u06CC \u06A9\u0648\u0686\u06A9: ${issue.origin} \u0628\u0627\u06CC\u062F ${adj}${issue.minimum.toString()} \u0628\u0627\u0634\u062F`;
          }
          case "invalid_format": {
            const _issue = issue;
            if (_issue.format === "starts_with") {
              return `\u0631\u0634\u062A\u0647 \u0646\u0627\u0645\u0639\u062A\u0628\u0631: \u0628\u0627\u06CC\u062F \u0628\u0627 "${_issue.prefix}" \u0634\u0631\u0648\u0639 \u0634\u0648\u062F`;
            }
            if (_issue.format === "ends_with") {
              return `\u0631\u0634\u062A\u0647 \u0646\u0627\u0645\u0639\u062A\u0628\u0631: \u0628\u0627\u06CC\u062F \u0628\u0627 "${_issue.suffix}" \u062A\u0645\u0627\u0645 \u0634\u0648\u062F`;
            }
            if (_issue.format === "includes") {
              return `\u0631\u0634\u062A\u0647 \u0646\u0627\u0645\u0639\u062A\u0628\u0631: \u0628\u0627\u06CC\u062F \u0634\u0627\u0645\u0644 "${_issue.includes}" \u0628\u0627\u0634\u062F`;
            }
            if (_issue.format === "regex") {
              return `\u0631\u0634\u062A\u0647 \u0646\u0627\u0645\u0639\u062A\u0628\u0631: \u0628\u0627\u06CC\u062F \u0628\u0627 \u0627\u0644\u06AF\u0648\u06CC ${_issue.pattern} \u0645\u0637\u0627\u0628\u0642\u062A \u062F\u0627\u0634\u062A\u0647 \u0628\u0627\u0634\u062F`;
            }
            return `${FormatDictionary[_issue.format] ?? issue.format} \u0646\u0627\u0645\u0639\u062A\u0628\u0631`;
          }
          case "not_multiple_of":
            return `\u0639\u062F\u062F \u0646\u0627\u0645\u0639\u062A\u0628\u0631: \u0628\u0627\u06CC\u062F \u0645\u0636\u0631\u0628 ${issue.divisor} \u0628\u0627\u0634\u062F`;
          case "unrecognized_keys":
            return `\u06A9\u0644\u06CC\u062F${issue.keys.length > 1 ? "\u0647\u0627\u06CC" : ""} \u0646\u0627\u0634\u0646\u0627\u0633: ${util.joinValues(issue.keys, ", ")}`;
          case "invalid_key":
            return `\u06A9\u0644\u06CC\u062F \u0646\u0627\u0634\u0646\u0627\u0633 \u062F\u0631 ${issue.origin}`;
          case "invalid_union":
            return `\u0648\u0631\u0648\u062F\u06CC \u0646\u0627\u0645\u0639\u062A\u0628\u0631`;
          case "invalid_element":
            return `\u0645\u0642\u062F\u0627\u0631 \u0646\u0627\u0645\u0639\u062A\u0628\u0631 \u062F\u0631 ${issue.origin}`;
          default:
            return `\u0648\u0631\u0648\u062F\u06CC \u0646\u0627\u0645\u0639\u062A\u0628\u0631`;
        }
      };
    }, "error");
    function default_1() {
      return {
        localeError: error()
      };
    }
    __name(default_1, "default_1");
    module2.exports = exports2.default;
  }
});

// node_modules/zod/v4/locales/fi.cjs
var require_fi = __commonJS({
  "node_modules/zod/v4/locales/fi.cjs"(exports2, module2) {
    "use strict";
    var __createBinding = exports2 && exports2.__createBinding || (Object.create ? (function(o, m, k, k2) {
      if (k2 === void 0) k2 = k;
      var desc = Object.getOwnPropertyDescriptor(m, k);
      if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
        desc = { enumerable: true, get: /* @__PURE__ */ __name(function() {
          return m[k];
        }, "get") };
      }
      Object.defineProperty(o, k2, desc);
    }) : (function(o, m, k, k2) {
      if (k2 === void 0) k2 = k;
      o[k2] = m[k];
    }));
    var __setModuleDefault = exports2 && exports2.__setModuleDefault || (Object.create ? (function(o, v) {
      Object.defineProperty(o, "default", { enumerable: true, value: v });
    }) : function(o, v) {
      o["default"] = v;
    });
    var __importStar = exports2 && exports2.__importStar || function(mod) {
      if (mod && mod.__esModule) return mod;
      var result = {};
      if (mod != null) {
        for (var k in mod) if (k !== "default" && Object.prototype.hasOwnProperty.call(mod, k)) __createBinding(result, mod, k);
      }
      __setModuleDefault(result, mod);
      return result;
    };
    Object.defineProperty(exports2, "__esModule", { value: true });
    exports2.default = default_1;
    var util = __importStar(require_util());
    var error = /* @__PURE__ */ __name(() => {
      const Sizable = {
        string: { unit: "merkki\xE4", subject: "merkkijonon" },
        file: { unit: "tavua", subject: "tiedoston" },
        array: { unit: "alkiota", subject: "listan" },
        set: { unit: "alkiota", subject: "joukon" },
        number: { unit: "", subject: "luvun" },
        bigint: { unit: "", subject: "suuren kokonaisluvun" },
        int: { unit: "", subject: "kokonaisluvun" },
        date: { unit: "", subject: "p\xE4iv\xE4m\xE4\xE4r\xE4n" }
      };
      function getSizing(origin) {
        return Sizable[origin] ?? null;
      }
      __name(getSizing, "getSizing");
      const FormatDictionary = {
        regex: "s\xE4\xE4nn\xF6llinen lauseke",
        email: "s\xE4hk\xF6postiosoite",
        url: "URL-osoite",
        emoji: "emoji",
        uuid: "UUID",
        uuidv4: "UUIDv4",
        uuidv6: "UUIDv6",
        nanoid: "nanoid",
        guid: "GUID",
        cuid: "cuid",
        cuid2: "cuid2",
        ulid: "ULID",
        xid: "XID",
        ksuid: "KSUID",
        datetime: "ISO-aikaleima",
        date: "ISO-p\xE4iv\xE4m\xE4\xE4r\xE4",
        time: "ISO-aika",
        duration: "ISO-kesto",
        ipv4: "IPv4-osoite",
        ipv6: "IPv6-osoite",
        cidrv4: "IPv4-alue",
        cidrv6: "IPv6-alue",
        base64: "base64-koodattu merkkijono",
        base64url: "base64url-koodattu merkkijono",
        json_string: "JSON-merkkijono",
        e164: "E.164-luku",
        jwt: "JWT",
        template_literal: "templaattimerkkijono"
      };
      const TypeDictionary = {
        nan: "NaN"
      };
      return (issue) => {
        switch (issue.code) {
          case "invalid_type": {
            const expected = TypeDictionary[issue.expected] ?? issue.expected;
            const receivedType = util.parsedType(issue.input);
            const received = TypeDictionary[receivedType] ?? receivedType;
            if (/^[A-Z]/.test(issue.expected)) {
              return `Virheellinen tyyppi: odotettiin instanceof ${issue.expected}, oli ${received}`;
            }
            return `Virheellinen tyyppi: odotettiin ${expected}, oli ${received}`;
          }
          case "invalid_value":
            if (issue.values.length === 1)
              return `Virheellinen sy\xF6te: t\xE4ytyy olla ${util.stringifyPrimitive(issue.values[0])}`;
            return `Virheellinen valinta: t\xE4ytyy olla yksi seuraavista: ${util.joinValues(issue.values, "|")}`;
          case "too_big": {
            const adj = issue.inclusive ? "<=" : "<";
            const sizing = getSizing(issue.origin);
            if (sizing) {
              return `Liian suuri: ${sizing.subject} t\xE4ytyy olla ${adj}${issue.maximum.toString()} ${sizing.unit}`.trim();
            }
            return `Liian suuri: arvon t\xE4ytyy olla ${adj}${issue.maximum.toString()}`;
          }
          case "too_small": {
            const adj = issue.inclusive ? ">=" : ">";
            const sizing = getSizing(issue.origin);
            if (sizing) {
              return `Liian pieni: ${sizing.subject} t\xE4ytyy olla ${adj}${issue.minimum.toString()} ${sizing.unit}`.trim();
            }
            return `Liian pieni: arvon t\xE4ytyy olla ${adj}${issue.minimum.toString()}`;
          }
          case "invalid_format": {
            const _issue = issue;
            if (_issue.format === "starts_with")
              return `Virheellinen sy\xF6te: t\xE4ytyy alkaa "${_issue.prefix}"`;
            if (_issue.format === "ends_with")
              return `Virheellinen sy\xF6te: t\xE4ytyy loppua "${_issue.suffix}"`;
            if (_issue.format === "includes")
              return `Virheellinen sy\xF6te: t\xE4ytyy sis\xE4lt\xE4\xE4 "${_issue.includes}"`;
            if (_issue.format === "regex") {
              return `Virheellinen sy\xF6te: t\xE4ytyy vastata s\xE4\xE4nn\xF6llist\xE4 lauseketta ${_issue.pattern}`;
            }
            return `Virheellinen ${FormatDictionary[_issue.format] ?? issue.format}`;
          }
          case "not_multiple_of":
            return `Virheellinen luku: t\xE4ytyy olla luvun ${issue.divisor} monikerta`;
          case "unrecognized_keys":
            return `${issue.keys.length > 1 ? "Tuntemattomat avaimet" : "Tuntematon avain"}: ${util.joinValues(issue.keys, ", ")}`;
          case "invalid_key":
            return "Virheellinen avain tietueessa";
          case "invalid_union":
            return "Virheellinen unioni";
          case "invalid_element":
            return "Virheellinen arvo joukossa";
          default:
            return `Virheellinen sy\xF6te`;
        }
      };
    }, "error");
    function default_1() {
      return {
        localeError: error()
      };
    }
    __name(default_1, "default_1");
    module2.exports = exports2.default;
  }
});

// node_modules/zod/v4/locales/fr.cjs
var require_fr = __commonJS({
  "node_modules/zod/v4/locales/fr.cjs"(exports2, module2) {
    "use strict";
    var __createBinding = exports2 && exports2.__createBinding || (Object.create ? (function(o, m, k, k2) {
      if (k2 === void 0) k2 = k;
      var desc = Object.getOwnPropertyDescriptor(m, k);
      if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
        desc = { enumerable: true, get: /* @__PURE__ */ __name(function() {
          return m[k];
        }, "get") };
      }
      Object.defineProperty(o, k2, desc);
    }) : (function(o, m, k, k2) {
      if (k2 === void 0) k2 = k;
      o[k2] = m[k];
    }));
    var __setModuleDefault = exports2 && exports2.__setModuleDefault || (Object.create ? (function(o, v) {
      Object.defineProperty(o, "default", { enumerable: true, value: v });
    }) : function(o, v) {
      o["default"] = v;
    });
    var __importStar = exports2 && exports2.__importStar || function(mod) {
      if (mod && mod.__esModule) return mod;
      var result = {};
      if (mod != null) {
        for (var k in mod) if (k !== "default" && Object.prototype.hasOwnProperty.call(mod, k)) __createBinding(result, mod, k);
      }
      __setModuleDefault(result, mod);
      return result;
    };
    Object.defineProperty(exports2, "__esModule", { value: true });
    exports2.default = default_1;
    var util = __importStar(require_util());
    var error = /* @__PURE__ */ __name(() => {
      const Sizable = {
        string: { unit: "caract\xE8res", verb: "avoir" },
        file: { unit: "octets", verb: "avoir" },
        array: { unit: "\xE9l\xE9ments", verb: "avoir" },
        set: { unit: "\xE9l\xE9ments", verb: "avoir" }
      };
      function getSizing(origin) {
        return Sizable[origin] ?? null;
      }
      __name(getSizing, "getSizing");
      const FormatDictionary = {
        regex: "entr\xE9e",
        email: "adresse e-mail",
        url: "URL",
        emoji: "emoji",
        uuid: "UUID",
        uuidv4: "UUIDv4",
        uuidv6: "UUIDv6",
        nanoid: "nanoid",
        guid: "GUID",
        cuid: "cuid",
        cuid2: "cuid2",
        ulid: "ULID",
        xid: "XID",
        ksuid: "KSUID",
        datetime: "date et heure ISO",
        date: "date ISO",
        time: "heure ISO",
        duration: "dur\xE9e ISO",
        ipv4: "adresse IPv4",
        ipv6: "adresse IPv6",
        cidrv4: "plage IPv4",
        cidrv6: "plage IPv6",
        base64: "cha\xEEne encod\xE9e en base64",
        base64url: "cha\xEEne encod\xE9e en base64url",
        json_string: "cha\xEEne JSON",
        e164: "num\xE9ro E.164",
        jwt: "JWT",
        template_literal: "entr\xE9e"
      };
      const TypeDictionary = {
        nan: "NaN",
        number: "nombre",
        array: "tableau"
      };
      return (issue) => {
        switch (issue.code) {
          case "invalid_type": {
            const expected = TypeDictionary[issue.expected] ?? issue.expected;
            const receivedType = util.parsedType(issue.input);
            const received = TypeDictionary[receivedType] ?? receivedType;
            if (/^[A-Z]/.test(issue.expected)) {
              return `Entr\xE9e invalide : instanceof ${issue.expected} attendu, ${received} re\xE7u`;
            }
            return `Entr\xE9e invalide : ${expected} attendu, ${received} re\xE7u`;
          }
          case "invalid_value":
            if (issue.values.length === 1)
              return `Entr\xE9e invalide : ${util.stringifyPrimitive(issue.values[0])} attendu`;
            return `Option invalide : une valeur parmi ${util.joinValues(issue.values, "|")} attendue`;
          case "too_big": {
            const adj = issue.inclusive ? "<=" : "<";
            const sizing = getSizing(issue.origin);
            if (sizing)
              return `Trop grand : ${issue.origin ?? "valeur"} doit ${sizing.verb} ${adj}${issue.maximum.toString()} ${sizing.unit ?? "\xE9l\xE9ment(s)"}`;
            return `Trop grand : ${issue.origin ?? "valeur"} doit \xEAtre ${adj}${issue.maximum.toString()}`;
          }
          case "too_small": {
            const adj = issue.inclusive ? ">=" : ">";
            const sizing = getSizing(issue.origin);
            if (sizing) {
              return `Trop petit : ${issue.origin} doit ${sizing.verb} ${adj}${issue.minimum.toString()} ${sizing.unit}`;
            }
            return `Trop petit : ${issue.origin} doit \xEAtre ${adj}${issue.minimum.toString()}`;
          }
          case "invalid_format": {
            const _issue = issue;
            if (_issue.format === "starts_with")
              return `Cha\xEEne invalide : doit commencer par "${_issue.prefix}"`;
            if (_issue.format === "ends_with")
              return `Cha\xEEne invalide : doit se terminer par "${_issue.suffix}"`;
            if (_issue.format === "includes")
              return `Cha\xEEne invalide : doit inclure "${_issue.includes}"`;
            if (_issue.format === "regex")
              return `Cha\xEEne invalide : doit correspondre au mod\xE8le ${_issue.pattern}`;
            return `${FormatDictionary[_issue.format] ?? issue.format} invalide`;
          }
          case "not_multiple_of":
            return `Nombre invalide : doit \xEAtre un multiple de ${issue.divisor}`;
          case "unrecognized_keys":
            return `Cl\xE9${issue.keys.length > 1 ? "s" : ""} non reconnue${issue.keys.length > 1 ? "s" : ""} : ${util.joinValues(issue.keys, ", ")}`;
          case "invalid_key":
            return `Cl\xE9 invalide dans ${issue.origin}`;
          case "invalid_union":
            return "Entr\xE9e invalide";
          case "invalid_element":
            return `Valeur invalide dans ${issue.origin}`;
          default:
            return `Entr\xE9e invalide`;
        }
      };
    }, "error");
    function default_1() {
      return {
        localeError: error()
      };
    }
    __name(default_1, "default_1");
    module2.exports = exports2.default;
  }
});

// node_modules/zod/v4/locales/fr-CA.cjs
var require_fr_CA = __commonJS({
  "node_modules/zod/v4/locales/fr-CA.cjs"(exports2, module2) {
    "use strict";
    var __createBinding = exports2 && exports2.__createBinding || (Object.create ? (function(o, m, k, k2) {
      if (k2 === void 0) k2 = k;
      var desc = Object.getOwnPropertyDescriptor(m, k);
      if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
        desc = { enumerable: true, get: /* @__PURE__ */ __name(function() {
          return m[k];
        }, "get") };
      }
      Object.defineProperty(o, k2, desc);
    }) : (function(o, m, k, k2) {
      if (k2 === void 0) k2 = k;
      o[k2] = m[k];
    }));
    var __setModuleDefault = exports2 && exports2.__setModuleDefault || (Object.create ? (function(o, v) {
      Object.defineProperty(o, "default", { enumerable: true, value: v });
    }) : function(o, v) {
      o["default"] = v;
    });
    var __importStar = exports2 && exports2.__importStar || function(mod) {
      if (mod && mod.__esModule) return mod;
      var result = {};
      if (mod != null) {
        for (var k in mod) if (k !== "default" && Object.prototype.hasOwnProperty.call(mod, k)) __createBinding(result, mod, k);
      }
      __setModuleDefault(result, mod);
      return result;
    };
    Object.defineProperty(exports2, "__esModule", { value: true });
    exports2.default = default_1;
    var util = __importStar(require_util());
    var error = /* @__PURE__ */ __name(() => {
      const Sizable = {
        string: { unit: "caract\xE8res", verb: "avoir" },
        file: { unit: "octets", verb: "avoir" },
        array: { unit: "\xE9l\xE9ments", verb: "avoir" },
        set: { unit: "\xE9l\xE9ments", verb: "avoir" }
      };
      function getSizing(origin) {
        return Sizable[origin] ?? null;
      }
      __name(getSizing, "getSizing");
      const FormatDictionary = {
        regex: "entr\xE9e",
        email: "adresse courriel",
        url: "URL",
        emoji: "emoji",
        uuid: "UUID",
        uuidv4: "UUIDv4",
        uuidv6: "UUIDv6",
        nanoid: "nanoid",
        guid: "GUID",
        cuid: "cuid",
        cuid2: "cuid2",
        ulid: "ULID",
        xid: "XID",
        ksuid: "KSUID",
        datetime: "date-heure ISO",
        date: "date ISO",
        time: "heure ISO",
        duration: "dur\xE9e ISO",
        ipv4: "adresse IPv4",
        ipv6: "adresse IPv6",
        cidrv4: "plage IPv4",
        cidrv6: "plage IPv6",
        base64: "cha\xEEne encod\xE9e en base64",
        base64url: "cha\xEEne encod\xE9e en base64url",
        json_string: "cha\xEEne JSON",
        e164: "num\xE9ro E.164",
        jwt: "JWT",
        template_literal: "entr\xE9e"
      };
      const TypeDictionary = {
        nan: "NaN"
      };
      return (issue) => {
        switch (issue.code) {
          case "invalid_type": {
            const expected = TypeDictionary[issue.expected] ?? issue.expected;
            const receivedType = util.parsedType(issue.input);
            const received = TypeDictionary[receivedType] ?? receivedType;
            if (/^[A-Z]/.test(issue.expected)) {
              return `Entr\xE9e invalide : attendu instanceof ${issue.expected}, re\xE7u ${received}`;
            }
            return `Entr\xE9e invalide : attendu ${expected}, re\xE7u ${received}`;
          }
          case "invalid_value":
            if (issue.values.length === 1)
              return `Entr\xE9e invalide : attendu ${util.stringifyPrimitive(issue.values[0])}`;
            return `Option invalide : attendu l'une des valeurs suivantes ${util.joinValues(issue.values, "|")}`;
          case "too_big": {
            const adj = issue.inclusive ? "\u2264" : "<";
            const sizing = getSizing(issue.origin);
            if (sizing)
              return `Trop grand : attendu que ${issue.origin ?? "la valeur"} ait ${adj}${issue.maximum.toString()} ${sizing.unit}`;
            return `Trop grand : attendu que ${issue.origin ?? "la valeur"} soit ${adj}${issue.maximum.toString()}`;
          }
          case "too_small": {
            const adj = issue.inclusive ? "\u2265" : ">";
            const sizing = getSizing(issue.origin);
            if (sizing) {
              return `Trop petit : attendu que ${issue.origin} ait ${adj}${issue.minimum.toString()} ${sizing.unit}`;
            }
            return `Trop petit : attendu que ${issue.origin} soit ${adj}${issue.minimum.toString()}`;
          }
          case "invalid_format": {
            const _issue = issue;
            if (_issue.format === "starts_with") {
              return `Cha\xEEne invalide : doit commencer par "${_issue.prefix}"`;
            }
            if (_issue.format === "ends_with")
              return `Cha\xEEne invalide : doit se terminer par "${_issue.suffix}"`;
            if (_issue.format === "includes")
              return `Cha\xEEne invalide : doit inclure "${_issue.includes}"`;
            if (_issue.format === "regex")
              return `Cha\xEEne invalide : doit correspondre au motif ${_issue.pattern}`;
            return `${FormatDictionary[_issue.format] ?? issue.format} invalide`;
          }
          case "not_multiple_of":
            return `Nombre invalide : doit \xEAtre un multiple de ${issue.divisor}`;
          case "unrecognized_keys":
            return `Cl\xE9${issue.keys.length > 1 ? "s" : ""} non reconnue${issue.keys.length > 1 ? "s" : ""} : ${util.joinValues(issue.keys, ", ")}`;
          case "invalid_key":
            return `Cl\xE9 invalide dans ${issue.origin}`;
          case "invalid_union":
            return "Entr\xE9e invalide";
          case "invalid_element":
            return `Valeur invalide dans ${issue.origin}`;
          default:
            return `Entr\xE9e invalide`;
        }
      };
    }, "error");
    function default_1() {
      return {
        localeError: error()
      };
    }
    __name(default_1, "default_1");
    module2.exports = exports2.default;
  }
});

// node_modules/zod/v4/locales/he.cjs
var require_he = __commonJS({
  "node_modules/zod/v4/locales/he.cjs"(exports2, module2) {
    "use strict";
    var __createBinding = exports2 && exports2.__createBinding || (Object.create ? (function(o, m, k, k2) {
      if (k2 === void 0) k2 = k;
      var desc = Object.getOwnPropertyDescriptor(m, k);
      if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
        desc = { enumerable: true, get: /* @__PURE__ */ __name(function() {
          return m[k];
        }, "get") };
      }
      Object.defineProperty(o, k2, desc);
    }) : (function(o, m, k, k2) {
      if (k2 === void 0) k2 = k;
      o[k2] = m[k];
    }));
    var __setModuleDefault = exports2 && exports2.__setModuleDefault || (Object.create ? (function(o, v) {
      Object.defineProperty(o, "default", { enumerable: true, value: v });
    }) : function(o, v) {
      o["default"] = v;
    });
    var __importStar = exports2 && exports2.__importStar || function(mod) {
      if (mod && mod.__esModule) return mod;
      var result = {};
      if (mod != null) {
        for (var k in mod) if (k !== "default" && Object.prototype.hasOwnProperty.call(mod, k)) __createBinding(result, mod, k);
      }
      __setModuleDefault(result, mod);
      return result;
    };
    Object.defineProperty(exports2, "__esModule", { value: true });
    exports2.default = default_1;
    var util = __importStar(require_util());
    var error = /* @__PURE__ */ __name(() => {
      const TypeNames = {
        string: { label: "\u05DE\u05D7\u05E8\u05D5\u05D6\u05EA", gender: "f" },
        number: { label: "\u05DE\u05E1\u05E4\u05E8", gender: "m" },
        boolean: { label: "\u05E2\u05E8\u05DA \u05D1\u05D5\u05DC\u05D9\u05D0\u05E0\u05D9", gender: "m" },
        bigint: { label: "BigInt", gender: "m" },
        date: { label: "\u05EA\u05D0\u05E8\u05D9\u05DA", gender: "m" },
        array: { label: "\u05DE\u05E2\u05E8\u05DA", gender: "m" },
        object: { label: "\u05D0\u05D5\u05D1\u05D9\u05D9\u05E7\u05D8", gender: "m" },
        null: { label: "\u05E2\u05E8\u05DA \u05E8\u05D9\u05E7 (null)", gender: "m" },
        undefined: { label: "\u05E2\u05E8\u05DA \u05DC\u05D0 \u05DE\u05D5\u05D2\u05D3\u05E8 (undefined)", gender: "m" },
        symbol: { label: "\u05E1\u05D9\u05DE\u05D1\u05D5\u05DC (Symbol)", gender: "m" },
        function: { label: "\u05E4\u05D5\u05E0\u05E7\u05E6\u05D9\u05D4", gender: "f" },
        map: { label: "\u05DE\u05E4\u05D4 (Map)", gender: "f" },
        set: { label: "\u05E7\u05D1\u05D5\u05E6\u05D4 (Set)", gender: "f" },
        file: { label: "\u05E7\u05D5\u05D1\u05E5", gender: "m" },
        promise: { label: "Promise", gender: "m" },
        NaN: { label: "NaN", gender: "m" },
        unknown: { label: "\u05E2\u05E8\u05DA \u05DC\u05D0 \u05D9\u05D3\u05D5\u05E2", gender: "m" },
        value: { label: "\u05E2\u05E8\u05DA", gender: "m" }
      };
      const Sizable = {
        string: { unit: "\u05EA\u05D5\u05D5\u05D9\u05DD", shortLabel: "\u05E7\u05E6\u05E8", longLabel: "\u05D0\u05E8\u05D5\u05DA" },
        file: { unit: "\u05D1\u05D9\u05D9\u05D8\u05D9\u05DD", shortLabel: "\u05E7\u05D8\u05DF", longLabel: "\u05D2\u05D3\u05D5\u05DC" },
        array: { unit: "\u05E4\u05E8\u05D9\u05D8\u05D9\u05DD", shortLabel: "\u05E7\u05D8\u05DF", longLabel: "\u05D2\u05D3\u05D5\u05DC" },
        set: { unit: "\u05E4\u05E8\u05D9\u05D8\u05D9\u05DD", shortLabel: "\u05E7\u05D8\u05DF", longLabel: "\u05D2\u05D3\u05D5\u05DC" },
        number: { unit: "", shortLabel: "\u05E7\u05D8\u05DF", longLabel: "\u05D2\u05D3\u05D5\u05DC" }
        // no unit
      };
      const typeEntry = /* @__PURE__ */ __name((t) => t ? TypeNames[t] : void 0, "typeEntry");
      const typeLabel = /* @__PURE__ */ __name((t) => {
        const e = typeEntry(t);
        if (e)
          return e.label;
        return t ?? TypeNames.unknown.label;
      }, "typeLabel");
      const withDefinite = /* @__PURE__ */ __name((t) => `\u05D4${typeLabel(t)}`, "withDefinite");
      const verbFor = /* @__PURE__ */ __name((t) => {
        const e = typeEntry(t);
        const gender = e?.gender ?? "m";
        return gender === "f" ? "\u05E6\u05E8\u05D9\u05DB\u05D4 \u05DC\u05D4\u05D9\u05D5\u05EA" : "\u05E6\u05E8\u05D9\u05DA \u05DC\u05D4\u05D9\u05D5\u05EA";
      }, "verbFor");
      const getSizing = /* @__PURE__ */ __name((origin) => {
        if (!origin)
          return null;
        return Sizable[origin] ?? null;
      }, "getSizing");
      const FormatDictionary = {
        regex: { label: "\u05E7\u05DC\u05D8", gender: "m" },
        email: { label: "\u05DB\u05EA\u05D5\u05D1\u05EA \u05D0\u05D9\u05DE\u05D9\u05D9\u05DC", gender: "f" },
        url: { label: "\u05DB\u05EA\u05D5\u05D1\u05EA \u05E8\u05E9\u05EA", gender: "f" },
        emoji: { label: "\u05D0\u05D9\u05DE\u05D5\u05D2'\u05D9", gender: "m" },
        uuid: { label: "UUID", gender: "m" },
        nanoid: { label: "nanoid", gender: "m" },
        guid: { label: "GUID", gender: "m" },
        cuid: { label: "cuid", gender: "m" },
        cuid2: { label: "cuid2", gender: "m" },
        ulid: { label: "ULID", gender: "m" },
        xid: { label: "XID", gender: "m" },
        ksuid: { label: "KSUID", gender: "m" },
        datetime: { label: "\u05EA\u05D0\u05E8\u05D9\u05DA \u05D5\u05D6\u05DE\u05DF ISO", gender: "m" },
        date: { label: "\u05EA\u05D0\u05E8\u05D9\u05DA ISO", gender: "m" },
        time: { label: "\u05D6\u05DE\u05DF ISO", gender: "m" },
        duration: { label: "\u05DE\u05E9\u05DA \u05D6\u05DE\u05DF ISO", gender: "m" },
        ipv4: { label: "\u05DB\u05EA\u05D5\u05D1\u05EA IPv4", gender: "f" },
        ipv6: { label: "\u05DB\u05EA\u05D5\u05D1\u05EA IPv6", gender: "f" },
        cidrv4: { label: "\u05D8\u05D5\u05D5\u05D7 IPv4", gender: "m" },
        cidrv6: { label: "\u05D8\u05D5\u05D5\u05D7 IPv6", gender: "m" },
        base64: { label: "\u05DE\u05D7\u05E8\u05D5\u05D6\u05EA \u05D1\u05D1\u05E1\u05D9\u05E1 64", gender: "f" },
        base64url: { label: "\u05DE\u05D7\u05E8\u05D5\u05D6\u05EA \u05D1\u05D1\u05E1\u05D9\u05E1 64 \u05DC\u05DB\u05EA\u05D5\u05D1\u05D5\u05EA \u05E8\u05E9\u05EA", gender: "f" },
        json_string: { label: "\u05DE\u05D7\u05E8\u05D5\u05D6\u05EA JSON", gender: "f" },
        e164: { label: "\u05DE\u05E1\u05E4\u05E8 E.164", gender: "m" },
        jwt: { label: "JWT", gender: "m" },
        ends_with: { label: "\u05E7\u05DC\u05D8", gender: "m" },
        includes: { label: "\u05E7\u05DC\u05D8", gender: "m" },
        lowercase: { label: "\u05E7\u05DC\u05D8", gender: "m" },
        starts_with: { label: "\u05E7\u05DC\u05D8", gender: "m" },
        uppercase: { label: "\u05E7\u05DC\u05D8", gender: "m" }
      };
      const TypeDictionary = {
        nan: "NaN"
      };
      return (issue) => {
        switch (issue.code) {
          case "invalid_type": {
            const expectedKey = issue.expected;
            const expected = TypeDictionary[expectedKey ?? ""] ?? typeLabel(expectedKey);
            const receivedType = util.parsedType(issue.input);
            const received = TypeDictionary[receivedType] ?? TypeNames[receivedType]?.label ?? receivedType;
            if (/^[A-Z]/.test(issue.expected)) {
              return `\u05E7\u05DC\u05D8 \u05DC\u05D0 \u05EA\u05E7\u05D9\u05DF: \u05E6\u05E8\u05D9\u05DA \u05DC\u05D4\u05D9\u05D5\u05EA instanceof ${issue.expected}, \u05D4\u05EA\u05E7\u05D1\u05DC ${received}`;
            }
            return `\u05E7\u05DC\u05D8 \u05DC\u05D0 \u05EA\u05E7\u05D9\u05DF: \u05E6\u05E8\u05D9\u05DA \u05DC\u05D4\u05D9\u05D5\u05EA ${expected}, \u05D4\u05EA\u05E7\u05D1\u05DC ${received}`;
          }
          case "invalid_value": {
            if (issue.values.length === 1) {
              return `\u05E2\u05E8\u05DA \u05DC\u05D0 \u05EA\u05E7\u05D9\u05DF: \u05D4\u05E2\u05E8\u05DA \u05D7\u05D9\u05D9\u05D1 \u05DC\u05D4\u05D9\u05D5\u05EA ${util.stringifyPrimitive(issue.values[0])}`;
            }
            const stringified = issue.values.map((v) => util.stringifyPrimitive(v));
            if (issue.values.length === 2) {
              return `\u05E2\u05E8\u05DA \u05DC\u05D0 \u05EA\u05E7\u05D9\u05DF: \u05D4\u05D0\u05E4\u05E9\u05E8\u05D5\u05D9\u05D5\u05EA \u05D4\u05DE\u05EA\u05D0\u05D9\u05DE\u05D5\u05EA \u05D4\u05DF ${stringified[0]} \u05D0\u05D5 ${stringified[1]}`;
            }
            const lastValue = stringified[stringified.length - 1];
            const restValues = stringified.slice(0, -1).join(", ");
            return `\u05E2\u05E8\u05DA \u05DC\u05D0 \u05EA\u05E7\u05D9\u05DF: \u05D4\u05D0\u05E4\u05E9\u05E8\u05D5\u05D9\u05D5\u05EA \u05D4\u05DE\u05EA\u05D0\u05D9\u05DE\u05D5\u05EA \u05D4\u05DF ${restValues} \u05D0\u05D5 ${lastValue}`;
          }
          case "too_big": {
            const sizing = getSizing(issue.origin);
            const subject = withDefinite(issue.origin ?? "value");
            if (issue.origin === "string") {
              return `${sizing?.longLabel ?? "\u05D0\u05E8\u05D5\u05DA"} \u05DE\u05D3\u05D9: ${subject} \u05E6\u05E8\u05D9\u05DB\u05D4 \u05DC\u05D4\u05DB\u05D9\u05DC ${issue.maximum.toString()} ${sizing?.unit ?? ""} ${issue.inclusive ? "\u05D0\u05D5 \u05E4\u05D7\u05D5\u05EA" : "\u05DC\u05DB\u05DC \u05D4\u05D9\u05D5\u05EA\u05E8"}`.trim();
            }
            if (issue.origin === "number") {
              const comparison = issue.inclusive ? `\u05E7\u05D8\u05DF \u05D0\u05D5 \u05E9\u05D5\u05D5\u05D4 \u05DC-${issue.maximum}` : `\u05E7\u05D8\u05DF \u05DE-${issue.maximum}`;
              return `\u05D2\u05D3\u05D5\u05DC \u05DE\u05D3\u05D9: ${subject} \u05E6\u05E8\u05D9\u05DA \u05DC\u05D4\u05D9\u05D5\u05EA ${comparison}`;
            }
            if (issue.origin === "array" || issue.origin === "set") {
              const verb = issue.origin === "set" ? "\u05E6\u05E8\u05D9\u05DB\u05D4" : "\u05E6\u05E8\u05D9\u05DA";
              const comparison = issue.inclusive ? `${issue.maximum} ${sizing?.unit ?? ""} \u05D0\u05D5 \u05E4\u05D7\u05D5\u05EA` : `\u05E4\u05D7\u05D5\u05EA \u05DE-${issue.maximum} ${sizing?.unit ?? ""}`;
              return `\u05D2\u05D3\u05D5\u05DC \u05DE\u05D3\u05D9: ${subject} ${verb} \u05DC\u05D4\u05DB\u05D9\u05DC ${comparison}`.trim();
            }
            const adj = issue.inclusive ? "<=" : "<";
            const be = verbFor(issue.origin ?? "value");
            if (sizing?.unit) {
              return `${sizing.longLabel} \u05DE\u05D3\u05D9: ${subject} ${be} ${adj}${issue.maximum.toString()} ${sizing.unit}`;
            }
            return `${sizing?.longLabel ?? "\u05D2\u05D3\u05D5\u05DC"} \u05DE\u05D3\u05D9: ${subject} ${be} ${adj}${issue.maximum.toString()}`;
          }
          case "too_small": {
            const sizing = getSizing(issue.origin);
            const subject = withDefinite(issue.origin ?? "value");
            if (issue.origin === "string") {
              return `${sizing?.shortLabel ?? "\u05E7\u05E6\u05E8"} \u05DE\u05D3\u05D9: ${subject} \u05E6\u05E8\u05D9\u05DB\u05D4 \u05DC\u05D4\u05DB\u05D9\u05DC ${issue.minimum.toString()} ${sizing?.unit ?? ""} ${issue.inclusive ? "\u05D0\u05D5 \u05D9\u05D5\u05EA\u05E8" : "\u05DC\u05E4\u05D7\u05D5\u05EA"}`.trim();
            }
            if (issue.origin === "number") {
              const comparison = issue.inclusive ? `\u05D2\u05D3\u05D5\u05DC \u05D0\u05D5 \u05E9\u05D5\u05D5\u05D4 \u05DC-${issue.minimum}` : `\u05D2\u05D3\u05D5\u05DC \u05DE-${issue.minimum}`;
              return `\u05E7\u05D8\u05DF \u05DE\u05D3\u05D9: ${subject} \u05E6\u05E8\u05D9\u05DA \u05DC\u05D4\u05D9\u05D5\u05EA ${comparison}`;
            }
            if (issue.origin === "array" || issue.origin === "set") {
              const verb = issue.origin === "set" ? "\u05E6\u05E8\u05D9\u05DB\u05D4" : "\u05E6\u05E8\u05D9\u05DA";
              if (issue.minimum === 1 && issue.inclusive) {
                const singularPhrase = issue.origin === "set" ? "\u05DC\u05E4\u05D7\u05D5\u05EA \u05E4\u05E8\u05D9\u05D8 \u05D0\u05D7\u05D3" : "\u05DC\u05E4\u05D7\u05D5\u05EA \u05E4\u05E8\u05D9\u05D8 \u05D0\u05D7\u05D3";
                return `\u05E7\u05D8\u05DF \u05DE\u05D3\u05D9: ${subject} ${verb} \u05DC\u05D4\u05DB\u05D9\u05DC ${singularPhrase}`;
              }
              const comparison = issue.inclusive ? `${issue.minimum} ${sizing?.unit ?? ""} \u05D0\u05D5 \u05D9\u05D5\u05EA\u05E8` : `\u05D9\u05D5\u05EA\u05E8 \u05DE-${issue.minimum} ${sizing?.unit ?? ""}`;
              return `\u05E7\u05D8\u05DF \u05DE\u05D3\u05D9: ${subject} ${verb} \u05DC\u05D4\u05DB\u05D9\u05DC ${comparison}`.trim();
            }
            const adj = issue.inclusive ? ">=" : ">";
            const be = verbFor(issue.origin ?? "value");
            if (sizing?.unit) {
              return `${sizing.shortLabel} \u05DE\u05D3\u05D9: ${subject} ${be} ${adj}${issue.minimum.toString()} ${sizing.unit}`;
            }
            return `${sizing?.shortLabel ?? "\u05E7\u05D8\u05DF"} \u05DE\u05D3\u05D9: ${subject} ${be} ${adj}${issue.minimum.toString()}`;
          }
          case "invalid_format": {
            const _issue = issue;
            if (_issue.format === "starts_with")
              return `\u05D4\u05DE\u05D7\u05E8\u05D5\u05D6\u05EA \u05D7\u05D9\u05D9\u05D1\u05EA \u05DC\u05D4\u05EA\u05D7\u05D9\u05DC \u05D1 "${_issue.prefix}"`;
            if (_issue.format === "ends_with")
              return `\u05D4\u05DE\u05D7\u05E8\u05D5\u05D6\u05EA \u05D7\u05D9\u05D9\u05D1\u05EA \u05DC\u05D4\u05E1\u05EA\u05D9\u05D9\u05DD \u05D1 "${_issue.suffix}"`;
            if (_issue.format === "includes")
              return `\u05D4\u05DE\u05D7\u05E8\u05D5\u05D6\u05EA \u05D7\u05D9\u05D9\u05D1\u05EA \u05DC\u05DB\u05DC\u05D5\u05DC "${_issue.includes}"`;
            if (_issue.format === "regex")
              return `\u05D4\u05DE\u05D7\u05E8\u05D5\u05D6\u05EA \u05D7\u05D9\u05D9\u05D1\u05EA \u05DC\u05D4\u05EA\u05D0\u05D9\u05DD \u05DC\u05EA\u05D1\u05E0\u05D9\u05EA ${_issue.pattern}`;
            const nounEntry = FormatDictionary[_issue.format];
            const noun = nounEntry?.label ?? _issue.format;
            const gender = nounEntry?.gender ?? "m";
            const adjective = gender === "f" ? "\u05EA\u05E7\u05D9\u05E0\u05D4" : "\u05EA\u05E7\u05D9\u05DF";
            return `${noun} \u05DC\u05D0 ${adjective}`;
          }
          case "not_multiple_of":
            return `\u05DE\u05E1\u05E4\u05E8 \u05DC\u05D0 \u05EA\u05E7\u05D9\u05DF: \u05D7\u05D9\u05D9\u05D1 \u05DC\u05D4\u05D9\u05D5\u05EA \u05DE\u05DB\u05E4\u05DC\u05D4 \u05E9\u05DC ${issue.divisor}`;
          case "unrecognized_keys":
            return `\u05DE\u05E4\u05EA\u05D7${issue.keys.length > 1 ? "\u05D5\u05EA" : ""} \u05DC\u05D0 \u05DE\u05D6\u05D5\u05D4${issue.keys.length > 1 ? "\u05D9\u05DD" : "\u05D4"}: ${util.joinValues(issue.keys, ", ")}`;
          case "invalid_key": {
            return `\u05E9\u05D3\u05D4 \u05DC\u05D0 \u05EA\u05E7\u05D9\u05DF \u05D1\u05D0\u05D5\u05D1\u05D9\u05D9\u05E7\u05D8`;
          }
          case "invalid_union":
            return "\u05E7\u05DC\u05D8 \u05DC\u05D0 \u05EA\u05E7\u05D9\u05DF";
          case "invalid_element": {
            const place = withDefinite(issue.origin ?? "array");
            return `\u05E2\u05E8\u05DA \u05DC\u05D0 \u05EA\u05E7\u05D9\u05DF \u05D1${place}`;
          }
          default:
            return `\u05E7\u05DC\u05D8 \u05DC\u05D0 \u05EA\u05E7\u05D9\u05DF`;
        }
      };
    }, "error");
    function default_1() {
      return {
        localeError: error()
      };
    }
    __name(default_1, "default_1");
    module2.exports = exports2.default;
  }
});

// node_modules/zod/v4/locales/hu.cjs
var require_hu = __commonJS({
  "node_modules/zod/v4/locales/hu.cjs"(exports2, module2) {
    "use strict";
    var __createBinding = exports2 && exports2.__createBinding || (Object.create ? (function(o, m, k, k2) {
      if (k2 === void 0) k2 = k;
      var desc = Object.getOwnPropertyDescriptor(m, k);
      if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
        desc = { enumerable: true, get: /* @__PURE__ */ __name(function() {
          return m[k];
        }, "get") };
      }
      Object.defineProperty(o, k2, desc);
    }) : (function(o, m, k, k2) {
      if (k2 === void 0) k2 = k;
      o[k2] = m[k];
    }));
    var __setModuleDefault = exports2 && exports2.__setModuleDefault || (Object.create ? (function(o, v) {
      Object.defineProperty(o, "default", { enumerable: true, value: v });
    }) : function(o, v) {
      o["default"] = v;
    });
    var __importStar = exports2 && exports2.__importStar || function(mod) {
      if (mod && mod.__esModule) return mod;
      var result = {};
      if (mod != null) {
        for (var k in mod) if (k !== "default" && Object.prototype.hasOwnProperty.call(mod, k)) __createBinding(result, mod, k);
      }
      __setModuleDefault(result, mod);
      return result;
    };
    Object.defineProperty(exports2, "__esModule", { value: true });
    exports2.default = default_1;
    var util = __importStar(require_util());
    var error = /* @__PURE__ */ __name(() => {
      const Sizable = {
        string: { unit: "karakter", verb: "legyen" },
        file: { unit: "byte", verb: "legyen" },
        array: { unit: "elem", verb: "legyen" },
        set: { unit: "elem", verb: "legyen" }
      };
      function getSizing(origin) {
        return Sizable[origin] ?? null;
      }
      __name(getSizing, "getSizing");
      const FormatDictionary = {
        regex: "bemenet",
        email: "email c\xEDm",
        url: "URL",
        emoji: "emoji",
        uuid: "UUID",
        uuidv4: "UUIDv4",
        uuidv6: "UUIDv6",
        nanoid: "nanoid",
        guid: "GUID",
        cuid: "cuid",
        cuid2: "cuid2",
        ulid: "ULID",
        xid: "XID",
        ksuid: "KSUID",
        datetime: "ISO id\u0151b\xE9lyeg",
        date: "ISO d\xE1tum",
        time: "ISO id\u0151",
        duration: "ISO id\u0151intervallum",
        ipv4: "IPv4 c\xEDm",
        ipv6: "IPv6 c\xEDm",
        cidrv4: "IPv4 tartom\xE1ny",
        cidrv6: "IPv6 tartom\xE1ny",
        base64: "base64-k\xF3dolt string",
        base64url: "base64url-k\xF3dolt string",
        json_string: "JSON string",
        e164: "E.164 sz\xE1m",
        jwt: "JWT",
        template_literal: "bemenet"
      };
      const TypeDictionary = {
        nan: "NaN",
        number: "sz\xE1m",
        array: "t\xF6mb"
      };
      return (issue) => {
        switch (issue.code) {
          case "invalid_type": {
            const expected = TypeDictionary[issue.expected] ?? issue.expected;
            const receivedType = util.parsedType(issue.input);
            const received = TypeDictionary[receivedType] ?? receivedType;
            if (/^[A-Z]/.test(issue.expected)) {
              return `\xC9rv\xE9nytelen bemenet: a v\xE1rt \xE9rt\xE9k instanceof ${issue.expected}, a kapott \xE9rt\xE9k ${received}`;
            }
            return `\xC9rv\xE9nytelen bemenet: a v\xE1rt \xE9rt\xE9k ${expected}, a kapott \xE9rt\xE9k ${received}`;
          }
          case "invalid_value":
            if (issue.values.length === 1)
              return `\xC9rv\xE9nytelen bemenet: a v\xE1rt \xE9rt\xE9k ${util.stringifyPrimitive(issue.values[0])}`;
            return `\xC9rv\xE9nytelen opci\xF3: valamelyik \xE9rt\xE9k v\xE1rt ${util.joinValues(issue.values, "|")}`;
          case "too_big": {
            const adj = issue.inclusive ? "<=" : "<";
            const sizing = getSizing(issue.origin);
            if (sizing)
              return `T\xFAl nagy: ${issue.origin ?? "\xE9rt\xE9k"} m\xE9rete t\xFAl nagy ${adj}${issue.maximum.toString()} ${sizing.unit ?? "elem"}`;
            return `T\xFAl nagy: a bemeneti \xE9rt\xE9k ${issue.origin ?? "\xE9rt\xE9k"} t\xFAl nagy: ${adj}${issue.maximum.toString()}`;
          }
          case "too_small": {
            const adj = issue.inclusive ? ">=" : ">";
            const sizing = getSizing(issue.origin);
            if (sizing) {
              return `T\xFAl kicsi: a bemeneti \xE9rt\xE9k ${issue.origin} m\xE9rete t\xFAl kicsi ${adj}${issue.minimum.toString()} ${sizing.unit}`;
            }
            return `T\xFAl kicsi: a bemeneti \xE9rt\xE9k ${issue.origin} t\xFAl kicsi ${adj}${issue.minimum.toString()}`;
          }
          case "invalid_format": {
            const _issue = issue;
            if (_issue.format === "starts_with")
              return `\xC9rv\xE9nytelen string: "${_issue.prefix}" \xE9rt\xE9kkel kell kezd\u0151dnie`;
            if (_issue.format === "ends_with")
              return `\xC9rv\xE9nytelen string: "${_issue.suffix}" \xE9rt\xE9kkel kell v\xE9gz\u0151dnie`;
            if (_issue.format === "includes")
              return `\xC9rv\xE9nytelen string: "${_issue.includes}" \xE9rt\xE9ket kell tartalmaznia`;
            if (_issue.format === "regex")
              return `\xC9rv\xE9nytelen string: ${_issue.pattern} mint\xE1nak kell megfelelnie`;
            return `\xC9rv\xE9nytelen ${FormatDictionary[_issue.format] ?? issue.format}`;
          }
          case "not_multiple_of":
            return `\xC9rv\xE9nytelen sz\xE1m: ${issue.divisor} t\xF6bbsz\xF6r\xF6s\xE9nek kell lennie`;
          case "unrecognized_keys":
            return `Ismeretlen kulcs${issue.keys.length > 1 ? "s" : ""}: ${util.joinValues(issue.keys, ", ")}`;
          case "invalid_key":
            return `\xC9rv\xE9nytelen kulcs ${issue.origin}`;
          case "invalid_union":
            return "\xC9rv\xE9nytelen bemenet";
          case "invalid_element":
            return `\xC9rv\xE9nytelen \xE9rt\xE9k: ${issue.origin}`;
          default:
            return `\xC9rv\xE9nytelen bemenet`;
        }
      };
    }, "error");
    function default_1() {
      return {
        localeError: error()
      };
    }
    __name(default_1, "default_1");
    module2.exports = exports2.default;
  }
});

// node_modules/zod/v4/locales/hy.cjs
var require_hy = __commonJS({
  "node_modules/zod/v4/locales/hy.cjs"(exports2, module2) {
    "use strict";
    var __createBinding = exports2 && exports2.__createBinding || (Object.create ? (function(o, m, k, k2) {
      if (k2 === void 0) k2 = k;
      var desc = Object.getOwnPropertyDescriptor(m, k);
      if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
        desc = { enumerable: true, get: /* @__PURE__ */ __name(function() {
          return m[k];
        }, "get") };
      }
      Object.defineProperty(o, k2, desc);
    }) : (function(o, m, k, k2) {
      if (k2 === void 0) k2 = k;
      o[k2] = m[k];
    }));
    var __setModuleDefault = exports2 && exports2.__setModuleDefault || (Object.create ? (function(o, v) {
      Object.defineProperty(o, "default", { enumerable: true, value: v });
    }) : function(o, v) {
      o["default"] = v;
    });
    var __importStar = exports2 && exports2.__importStar || function(mod) {
      if (mod && mod.__esModule) return mod;
      var result = {};
      if (mod != null) {
        for (var k in mod) if (k !== "default" && Object.prototype.hasOwnProperty.call(mod, k)) __createBinding(result, mod, k);
      }
      __setModuleDefault(result, mod);
      return result;
    };
    Object.defineProperty(exports2, "__esModule", { value: true });
    exports2.default = default_1;
    var util = __importStar(require_util());
    function getArmenianPlural(count, one, many) {
      return Math.abs(count) === 1 ? one : many;
    }
    __name(getArmenianPlural, "getArmenianPlural");
    function withDefiniteArticle(word) {
      if (!word)
        return "";
      const vowels = ["\u0561", "\u0565", "\u0568", "\u056B", "\u0578", "\u0578\u0582", "\u0585"];
      const lastChar = word[word.length - 1];
      return word + (vowels.includes(lastChar) ? "\u0576" : "\u0568");
    }
    __name(withDefiniteArticle, "withDefiniteArticle");
    var error = /* @__PURE__ */ __name(() => {
      const Sizable = {
        string: {
          unit: {
            one: "\u0576\u0577\u0561\u0576",
            many: "\u0576\u0577\u0561\u0576\u0576\u0565\u0580"
          },
          verb: "\u0578\u0582\u0576\u0565\u0576\u0561\u056C"
        },
        file: {
          unit: {
            one: "\u0562\u0561\u0575\u0569",
            many: "\u0562\u0561\u0575\u0569\u0565\u0580"
          },
          verb: "\u0578\u0582\u0576\u0565\u0576\u0561\u056C"
        },
        array: {
          unit: {
            one: "\u057F\u0561\u0580\u0580",
            many: "\u057F\u0561\u0580\u0580\u0565\u0580"
          },
          verb: "\u0578\u0582\u0576\u0565\u0576\u0561\u056C"
        },
        set: {
          unit: {
            one: "\u057F\u0561\u0580\u0580",
            many: "\u057F\u0561\u0580\u0580\u0565\u0580"
          },
          verb: "\u0578\u0582\u0576\u0565\u0576\u0561\u056C"
        }
      };
      function getSizing(origin) {
        return Sizable[origin] ?? null;
      }
      __name(getSizing, "getSizing");
      const FormatDictionary = {
        regex: "\u0574\u0578\u0582\u057F\u0584",
        email: "\u0567\u056C. \u0570\u0561\u057D\u0581\u0565",
        url: "URL",
        emoji: "\u0567\u0574\u0578\u057B\u056B",
        uuid: "UUID",
        uuidv4: "UUIDv4",
        uuidv6: "UUIDv6",
        nanoid: "nanoid",
        guid: "GUID",
        cuid: "cuid",
        cuid2: "cuid2",
        ulid: "ULID",
        xid: "XID",
        ksuid: "KSUID",
        datetime: "ISO \u0561\u0574\u057D\u0561\u0569\u056B\u057E \u0587 \u056A\u0561\u0574",
        date: "ISO \u0561\u0574\u057D\u0561\u0569\u056B\u057E",
        time: "ISO \u056A\u0561\u0574",
        duration: "ISO \u057F\u0587\u0578\u0572\u0578\u0582\u0569\u0575\u0578\u0582\u0576",
        ipv4: "IPv4 \u0570\u0561\u057D\u0581\u0565",
        ipv6: "IPv6 \u0570\u0561\u057D\u0581\u0565",
        cidrv4: "IPv4 \u0574\u056B\u057B\u0561\u056F\u0561\u0575\u0584",
        cidrv6: "IPv6 \u0574\u056B\u057B\u0561\u056F\u0561\u0575\u0584",
        base64: "base64 \u0571\u0587\u0561\u0579\u0561\u0583\u0578\u057E \u057F\u0578\u0572",
        base64url: "base64url \u0571\u0587\u0561\u0579\u0561\u0583\u0578\u057E \u057F\u0578\u0572",
        json_string: "JSON \u057F\u0578\u0572",
        e164: "E.164 \u0570\u0561\u0574\u0561\u0580",
        jwt: "JWT",
        template_literal: "\u0574\u0578\u0582\u057F\u0584"
      };
      const TypeDictionary = {
        nan: "NaN",
        number: "\u0569\u056B\u057E",
        array: "\u0566\u0561\u0576\u0563\u057E\u0561\u056E"
      };
      return (issue) => {
        switch (issue.code) {
          case "invalid_type": {
            const expected = TypeDictionary[issue.expected] ?? issue.expected;
            const receivedType = util.parsedType(issue.input);
            const received = TypeDictionary[receivedType] ?? receivedType;
            if (/^[A-Z]/.test(issue.expected)) {
              return `\u054D\u056D\u0561\u056C \u0574\u0578\u0582\u057F\u0584\u0561\u0563\u0580\u0578\u0582\u0574\u2024 \u057D\u057A\u0561\u057D\u057E\u0578\u0582\u0574 \u0567\u0580 instanceof ${issue.expected}, \u057D\u057F\u0561\u0581\u057E\u0565\u056C \u0567 ${received}`;
            }
            return `\u054D\u056D\u0561\u056C \u0574\u0578\u0582\u057F\u0584\u0561\u0563\u0580\u0578\u0582\u0574\u2024 \u057D\u057A\u0561\u057D\u057E\u0578\u0582\u0574 \u0567\u0580 ${expected}, \u057D\u057F\u0561\u0581\u057E\u0565\u056C \u0567 ${received}`;
          }
          case "invalid_value":
            if (issue.values.length === 1)
              return `\u054D\u056D\u0561\u056C \u0574\u0578\u0582\u057F\u0584\u0561\u0563\u0580\u0578\u0582\u0574\u2024 \u057D\u057A\u0561\u057D\u057E\u0578\u0582\u0574 \u0567\u0580 ${util.stringifyPrimitive(issue.values[1])}`;
            return `\u054D\u056D\u0561\u056C \u057F\u0561\u0580\u0562\u0565\u0580\u0561\u056F\u2024 \u057D\u057A\u0561\u057D\u057E\u0578\u0582\u0574 \u0567\u0580 \u0570\u0565\u057F\u0587\u0575\u0561\u056C\u0576\u0565\u0580\u056B\u0581 \u0574\u0565\u056F\u0568\u055D ${util.joinValues(issue.values, "|")}`;
          case "too_big": {
            const adj = issue.inclusive ? "<=" : "<";
            const sizing = getSizing(issue.origin);
            if (sizing) {
              const maxValue = Number(issue.maximum);
              const unit = getArmenianPlural(maxValue, sizing.unit.one, sizing.unit.many);
              return `\u0549\u0561\u0583\u0561\u0566\u0561\u0576\u0581 \u0574\u0565\u056E \u0561\u0580\u056A\u0565\u0584\u2024 \u057D\u057A\u0561\u057D\u057E\u0578\u0582\u0574 \u0567, \u0578\u0580 ${withDefiniteArticle(issue.origin ?? "\u0561\u0580\u056A\u0565\u0584")} \u056F\u0578\u0582\u0576\u0565\u0576\u0561 ${adj}${issue.maximum.toString()} ${unit}`;
            }
            return `\u0549\u0561\u0583\u0561\u0566\u0561\u0576\u0581 \u0574\u0565\u056E \u0561\u0580\u056A\u0565\u0584\u2024 \u057D\u057A\u0561\u057D\u057E\u0578\u0582\u0574 \u0567, \u0578\u0580 ${withDefiniteArticle(issue.origin ?? "\u0561\u0580\u056A\u0565\u0584")} \u056C\u056B\u0576\u056B ${adj}${issue.maximum.toString()}`;
          }
          case "too_small": {
            const adj = issue.inclusive ? ">=" : ">";
            const sizing = getSizing(issue.origin);
            if (sizing) {
              const minValue = Number(issue.minimum);
              const unit = getArmenianPlural(minValue, sizing.unit.one, sizing.unit.many);
              return `\u0549\u0561\u0583\u0561\u0566\u0561\u0576\u0581 \u0583\u0578\u0584\u0580 \u0561\u0580\u056A\u0565\u0584\u2024 \u057D\u057A\u0561\u057D\u057E\u0578\u0582\u0574 \u0567, \u0578\u0580 ${withDefiniteArticle(issue.origin)} \u056F\u0578\u0582\u0576\u0565\u0576\u0561 ${adj}${issue.minimum.toString()} ${unit}`;
            }
            return `\u0549\u0561\u0583\u0561\u0566\u0561\u0576\u0581 \u0583\u0578\u0584\u0580 \u0561\u0580\u056A\u0565\u0584\u2024 \u057D\u057A\u0561\u057D\u057E\u0578\u0582\u0574 \u0567, \u0578\u0580 ${withDefiniteArticle(issue.origin)} \u056C\u056B\u0576\u056B ${adj}${issue.minimum.toString()}`;
          }
          case "invalid_format": {
            const _issue = issue;
            if (_issue.format === "starts_with")
              return `\u054D\u056D\u0561\u056C \u057F\u0578\u0572\u2024 \u057A\u0565\u057F\u0584 \u0567 \u057D\u056F\u057D\u057E\u056B "${_issue.prefix}"-\u0578\u057E`;
            if (_issue.format === "ends_with")
              return `\u054D\u056D\u0561\u056C \u057F\u0578\u0572\u2024 \u057A\u0565\u057F\u0584 \u0567 \u0561\u057E\u0561\u0580\u057F\u057E\u056B "${_issue.suffix}"-\u0578\u057E`;
            if (_issue.format === "includes")
              return `\u054D\u056D\u0561\u056C \u057F\u0578\u0572\u2024 \u057A\u0565\u057F\u0584 \u0567 \u057A\u0561\u0580\u0578\u0582\u0576\u0561\u056F\u056B "${_issue.includes}"`;
            if (_issue.format === "regex")
              return `\u054D\u056D\u0561\u056C \u057F\u0578\u0572\u2024 \u057A\u0565\u057F\u0584 \u0567 \u0570\u0561\u0574\u0561\u057A\u0561\u057F\u0561\u057D\u056D\u0561\u0576\u056B ${_issue.pattern} \u0571\u0587\u0561\u0579\u0561\u0583\u056B\u0576`;
            return `\u054D\u056D\u0561\u056C ${FormatDictionary[_issue.format] ?? issue.format}`;
          }
          case "not_multiple_of":
            return `\u054D\u056D\u0561\u056C \u0569\u056B\u057E\u2024 \u057A\u0565\u057F\u0584 \u0567 \u0562\u0561\u0566\u0574\u0561\u057A\u0561\u057F\u056B\u056F \u056C\u056B\u0576\u056B ${issue.divisor}-\u056B`;
          case "unrecognized_keys":
            return `\u0549\u0573\u0561\u0576\u0561\u0579\u057E\u0561\u056E \u0562\u0561\u0576\u0561\u056C\u056B${issue.keys.length > 1 ? "\u0576\u0565\u0580" : ""}. ${util.joinValues(issue.keys, ", ")}`;
          case "invalid_key":
            return `\u054D\u056D\u0561\u056C \u0562\u0561\u0576\u0561\u056C\u056B ${withDefiniteArticle(issue.origin)}-\u0578\u0582\u0574`;
          case "invalid_union":
            return "\u054D\u056D\u0561\u056C \u0574\u0578\u0582\u057F\u0584\u0561\u0563\u0580\u0578\u0582\u0574";
          case "invalid_element":
            return `\u054D\u056D\u0561\u056C \u0561\u0580\u056A\u0565\u0584 ${withDefiniteArticle(issue.origin)}-\u0578\u0582\u0574`;
          default:
            return `\u054D\u056D\u0561\u056C \u0574\u0578\u0582\u057F\u0584\u0561\u0563\u0580\u0578\u0582\u0574`;
        }
      };
    }, "error");
    function default_1() {
      return {
        localeError: error()
      };
    }
    __name(default_1, "default_1");
    module2.exports = exports2.default;
  }
});

// node_modules/zod/v4/locales/id.cjs
var require_id = __commonJS({
  "node_modules/zod/v4/locales/id.cjs"(exports2, module2) {
    "use strict";
    var __createBinding = exports2 && exports2.__createBinding || (Object.create ? (function(o, m, k, k2) {
      if (k2 === void 0) k2 = k;
      var desc = Object.getOwnPropertyDescriptor(m, k);
      if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
        desc = { enumerable: true, get: /* @__PURE__ */ __name(function() {
          return m[k];
        }, "get") };
      }
      Object.defineProperty(o, k2, desc);
    }) : (function(o, m, k, k2) {
      if (k2 === void 0) k2 = k;
      o[k2] = m[k];
    }));
    var __setModuleDefault = exports2 && exports2.__setModuleDefault || (Object.create ? (function(o, v) {
      Object.defineProperty(o, "default", { enumerable: true, value: v });
    }) : function(o, v) {
      o["default"] = v;
    });
    var __importStar = exports2 && exports2.__importStar || function(mod) {
      if (mod && mod.__esModule) return mod;
      var result = {};
      if (mod != null) {
        for (var k in mod) if (k !== "default" && Object.prototype.hasOwnProperty.call(mod, k)) __createBinding(result, mod, k);
      }
      __setModuleDefault(result, mod);
      return result;
    };
    Object.defineProperty(exports2, "__esModule", { value: true });
    exports2.default = default_1;
    var util = __importStar(require_util());
    var error = /* @__PURE__ */ __name(() => {
      const Sizable = {
        string: { unit: "karakter", verb: "memiliki" },
        file: { unit: "byte", verb: "memiliki" },
        array: { unit: "item", verb: "memiliki" },
        set: { unit: "item", verb: "memiliki" }
      };
      function getSizing(origin) {
        return Sizable[origin] ?? null;
      }
      __name(getSizing, "getSizing");
      const FormatDictionary = {
        regex: "input",
        email: "alamat email",
        url: "URL",
        emoji: "emoji",
        uuid: "UUID",
        uuidv4: "UUIDv4",
        uuidv6: "UUIDv6",
        nanoid: "nanoid",
        guid: "GUID",
        cuid: "cuid",
        cuid2: "cuid2",
        ulid: "ULID",
        xid: "XID",
        ksuid: "KSUID",
        datetime: "tanggal dan waktu format ISO",
        date: "tanggal format ISO",
        time: "jam format ISO",
        duration: "durasi format ISO",
        ipv4: "alamat IPv4",
        ipv6: "alamat IPv6",
        cidrv4: "rentang alamat IPv4",
        cidrv6: "rentang alamat IPv6",
        base64: "string dengan enkode base64",
        base64url: "string dengan enkode base64url",
        json_string: "string JSON",
        e164: "angka E.164",
        jwt: "JWT",
        template_literal: "input"
      };
      const TypeDictionary = {
        nan: "NaN"
      };
      return (issue) => {
        switch (issue.code) {
          case "invalid_type": {
            const expected = TypeDictionary[issue.expected] ?? issue.expected;
            const receivedType = util.parsedType(issue.input);
            const received = TypeDictionary[receivedType] ?? receivedType;
            if (/^[A-Z]/.test(issue.expected)) {
              return `Input tidak valid: diharapkan instanceof ${issue.expected}, diterima ${received}`;
            }
            return `Input tidak valid: diharapkan ${expected}, diterima ${received}`;
          }
          case "invalid_value":
            if (issue.values.length === 1)
              return `Input tidak valid: diharapkan ${util.stringifyPrimitive(issue.values[0])}`;
            return `Pilihan tidak valid: diharapkan salah satu dari ${util.joinValues(issue.values, "|")}`;
          case "too_big": {
            const adj = issue.inclusive ? "<=" : "<";
            const sizing = getSizing(issue.origin);
            if (sizing)
              return `Terlalu besar: diharapkan ${issue.origin ?? "value"} memiliki ${adj}${issue.maximum.toString()} ${sizing.unit ?? "elemen"}`;
            return `Terlalu besar: diharapkan ${issue.origin ?? "value"} menjadi ${adj}${issue.maximum.toString()}`;
          }
          case "too_small": {
            const adj = issue.inclusive ? ">=" : ">";
            const sizing = getSizing(issue.origin);
            if (sizing) {
              return `Terlalu kecil: diharapkan ${issue.origin} memiliki ${adj}${issue.minimum.toString()} ${sizing.unit}`;
            }
            return `Terlalu kecil: diharapkan ${issue.origin} menjadi ${adj}${issue.minimum.toString()}`;
          }
          case "invalid_format": {
            const _issue = issue;
            if (_issue.format === "starts_with")
              return `String tidak valid: harus dimulai dengan "${_issue.prefix}"`;
            if (_issue.format === "ends_with")
              return `String tidak valid: harus berakhir dengan "${_issue.suffix}"`;
            if (_issue.format === "includes")
              return `String tidak valid: harus menyertakan "${_issue.includes}"`;
            if (_issue.format === "regex")
              return `String tidak valid: harus sesuai pola ${_issue.pattern}`;
            return `${FormatDictionary[_issue.format] ?? issue.format} tidak valid`;
          }
          case "not_multiple_of":
            return `Angka tidak valid: harus kelipatan dari ${issue.divisor}`;
          case "unrecognized_keys":
            return `Kunci tidak dikenali ${issue.keys.length > 1 ? "s" : ""}: ${util.joinValues(issue.keys, ", ")}`;
          case "invalid_key":
            return `Kunci tidak valid di ${issue.origin}`;
          case "invalid_union":
            return "Input tidak valid";
          case "invalid_element":
            return `Nilai tidak valid di ${issue.origin}`;
          default:
            return `Input tidak valid`;
        }
      };
    }, "error");
    function default_1() {
      return {
        localeError: error()
      };
    }
    __name(default_1, "default_1");
    module2.exports = exports2.default;
  }
});

// node_modules/zod/v4/locales/is.cjs
var require_is = __commonJS({
  "node_modules/zod/v4/locales/is.cjs"(exports2, module2) {
    "use strict";
    var __createBinding = exports2 && exports2.__createBinding || (Object.create ? (function(o, m, k, k2) {
      if (k2 === void 0) k2 = k;
      var desc = Object.getOwnPropertyDescriptor(m, k);
      if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
        desc = { enumerable: true, get: /* @__PURE__ */ __name(function() {
          return m[k];
        }, "get") };
      }
      Object.defineProperty(o, k2, desc);
    }) : (function(o, m, k, k2) {
      if (k2 === void 0) k2 = k;
      o[k2] = m[k];
    }));
    var __setModuleDefault = exports2 && exports2.__setModuleDefault || (Object.create ? (function(o, v) {
      Object.defineProperty(o, "default", { enumerable: true, value: v });
    }) : function(o, v) {
      o["default"] = v;
    });
    var __importStar = exports2 && exports2.__importStar || function(mod) {
      if (mod && mod.__esModule) return mod;
      var result = {};
      if (mod != null) {
        for (var k in mod) if (k !== "default" && Object.prototype.hasOwnProperty.call(mod, k)) __createBinding(result, mod, k);
      }
      __setModuleDefault(result, mod);
      return result;
    };
    Object.defineProperty(exports2, "__esModule", { value: true });
    exports2.default = default_1;
    var util = __importStar(require_util());
    var error = /* @__PURE__ */ __name(() => {
      const Sizable = {
        string: { unit: "stafi", verb: "a\xF0 hafa" },
        file: { unit: "b\xE6ti", verb: "a\xF0 hafa" },
        array: { unit: "hluti", verb: "a\xF0 hafa" },
        set: { unit: "hluti", verb: "a\xF0 hafa" }
      };
      function getSizing(origin) {
        return Sizable[origin] ?? null;
      }
      __name(getSizing, "getSizing");
      const FormatDictionary = {
        regex: "gildi",
        email: "netfang",
        url: "vefsl\xF3\xF0",
        emoji: "emoji",
        uuid: "UUID",
        uuidv4: "UUIDv4",
        uuidv6: "UUIDv6",
        nanoid: "nanoid",
        guid: "GUID",
        cuid: "cuid",
        cuid2: "cuid2",
        ulid: "ULID",
        xid: "XID",
        ksuid: "KSUID",
        datetime: "ISO dagsetning og t\xEDmi",
        date: "ISO dagsetning",
        time: "ISO t\xEDmi",
        duration: "ISO t\xEDmalengd",
        ipv4: "IPv4 address",
        ipv6: "IPv6 address",
        cidrv4: "IPv4 range",
        cidrv6: "IPv6 range",
        base64: "base64-encoded strengur",
        base64url: "base64url-encoded strengur",
        json_string: "JSON strengur",
        e164: "E.164 t\xF6lugildi",
        jwt: "JWT",
        template_literal: "gildi"
      };
      const TypeDictionary = {
        nan: "NaN",
        number: "n\xFAmer",
        array: "fylki"
      };
      return (issue) => {
        switch (issue.code) {
          case "invalid_type": {
            const expected = TypeDictionary[issue.expected] ?? issue.expected;
            const receivedType = util.parsedType(issue.input);
            const received = TypeDictionary[receivedType] ?? receivedType;
            if (/^[A-Z]/.test(issue.expected)) {
              return `Rangt gildi: \xDE\xFA sl\xF3st inn ${received} \xFEar sem \xE1 a\xF0 vera instanceof ${issue.expected}`;
            }
            return `Rangt gildi: \xDE\xFA sl\xF3st inn ${received} \xFEar sem \xE1 a\xF0 vera ${expected}`;
          }
          case "invalid_value":
            if (issue.values.length === 1)
              return `Rangt gildi: gert r\xE1\xF0 fyrir ${util.stringifyPrimitive(issue.values[0])}`;
            return `\xD3gilt val: m\xE1 vera eitt af eftirfarandi ${util.joinValues(issue.values, "|")}`;
          case "too_big": {
            const adj = issue.inclusive ? "<=" : "<";
            const sizing = getSizing(issue.origin);
            if (sizing)
              return `Of st\xF3rt: gert er r\xE1\xF0 fyrir a\xF0 ${issue.origin ?? "gildi"} hafi ${adj}${issue.maximum.toString()} ${sizing.unit ?? "hluti"}`;
            return `Of st\xF3rt: gert er r\xE1\xF0 fyrir a\xF0 ${issue.origin ?? "gildi"} s\xE9 ${adj}${issue.maximum.toString()}`;
          }
          case "too_small": {
            const adj = issue.inclusive ? ">=" : ">";
            const sizing = getSizing(issue.origin);
            if (sizing) {
              return `Of l\xEDti\xF0: gert er r\xE1\xF0 fyrir a\xF0 ${issue.origin} hafi ${adj}${issue.minimum.toString()} ${sizing.unit}`;
            }
            return `Of l\xEDti\xF0: gert er r\xE1\xF0 fyrir a\xF0 ${issue.origin} s\xE9 ${adj}${issue.minimum.toString()}`;
          }
          case "invalid_format": {
            const _issue = issue;
            if (_issue.format === "starts_with") {
              return `\xD3gildur strengur: ver\xF0ur a\xF0 byrja \xE1 "${_issue.prefix}"`;
            }
            if (_issue.format === "ends_with")
              return `\xD3gildur strengur: ver\xF0ur a\xF0 enda \xE1 "${_issue.suffix}"`;
            if (_issue.format === "includes")
              return `\xD3gildur strengur: ver\xF0ur a\xF0 innihalda "${_issue.includes}"`;
            if (_issue.format === "regex")
              return `\xD3gildur strengur: ver\xF0ur a\xF0 fylgja mynstri ${_issue.pattern}`;
            return `Rangt ${FormatDictionary[_issue.format] ?? issue.format}`;
          }
          case "not_multiple_of":
            return `R\xF6ng tala: ver\xF0ur a\xF0 vera margfeldi af ${issue.divisor}`;
          case "unrecognized_keys":
            return `\xD3\xFEekkt ${issue.keys.length > 1 ? "ir lyklar" : "ur lykill"}: ${util.joinValues(issue.keys, ", ")}`;
          case "invalid_key":
            return `Rangur lykill \xED ${issue.origin}`;
          case "invalid_union":
            return "Rangt gildi";
          case "invalid_element":
            return `Rangt gildi \xED ${issue.origin}`;
          default:
            return `Rangt gildi`;
        }
      };
    }, "error");
    function default_1() {
      return {
        localeError: error()
      };
    }
    __name(default_1, "default_1");
    module2.exports = exports2.default;
  }
});

// node_modules/zod/v4/locales/it.cjs
var require_it = __commonJS({
  "node_modules/zod/v4/locales/it.cjs"(exports2, module2) {
    "use strict";
    var __createBinding = exports2 && exports2.__createBinding || (Object.create ? (function(o, m, k, k2) {
      if (k2 === void 0) k2 = k;
      var desc = Object.getOwnPropertyDescriptor(m, k);
      if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
        desc = { enumerable: true, get: /* @__PURE__ */ __name(function() {
          return m[k];
        }, "get") };
      }
      Object.defineProperty(o, k2, desc);
    }) : (function(o, m, k, k2) {
      if (k2 === void 0) k2 = k;
      o[k2] = m[k];
    }));
    var __setModuleDefault = exports2 && exports2.__setModuleDefault || (Object.create ? (function(o, v) {
      Object.defineProperty(o, "default", { enumerable: true, value: v });
    }) : function(o, v) {
      o["default"] = v;
    });
    var __importStar = exports2 && exports2.__importStar || function(mod) {
      if (mod && mod.__esModule) return mod;
      var result = {};
      if (mod != null) {
        for (var k in mod) if (k !== "default" && Object.prototype.hasOwnProperty.call(mod, k)) __createBinding(result, mod, k);
      }
      __setModuleDefault(result, mod);
      return result;
    };
    Object.defineProperty(exports2, "__esModule", { value: true });
    exports2.default = default_1;
    var util = __importStar(require_util());
    var error = /* @__PURE__ */ __name(() => {
      const Sizable = {
        string: { unit: "caratteri", verb: "avere" },
        file: { unit: "byte", verb: "avere" },
        array: { unit: "elementi", verb: "avere" },
        set: { unit: "elementi", verb: "avere" }
      };
      function getSizing(origin) {
        return Sizable[origin] ?? null;
      }
      __name(getSizing, "getSizing");
      const FormatDictionary = {
        regex: "input",
        email: "indirizzo email",
        url: "URL",
        emoji: "emoji",
        uuid: "UUID",
        uuidv4: "UUIDv4",
        uuidv6: "UUIDv6",
        nanoid: "nanoid",
        guid: "GUID",
        cuid: "cuid",
        cuid2: "cuid2",
        ulid: "ULID",
        xid: "XID",
        ksuid: "KSUID",
        datetime: "data e ora ISO",
        date: "data ISO",
        time: "ora ISO",
        duration: "durata ISO",
        ipv4: "indirizzo IPv4",
        ipv6: "indirizzo IPv6",
        cidrv4: "intervallo IPv4",
        cidrv6: "intervallo IPv6",
        base64: "stringa codificata in base64",
        base64url: "URL codificata in base64",
        json_string: "stringa JSON",
        e164: "numero E.164",
        jwt: "JWT",
        template_literal: "input"
      };
      const TypeDictionary = {
        nan: "NaN",
        number: "numero",
        array: "vettore"
      };
      return (issue) => {
        switch (issue.code) {
          case "invalid_type": {
            const expected = TypeDictionary[issue.expected] ?? issue.expected;
            const receivedType = util.parsedType(issue.input);
            const received = TypeDictionary[receivedType] ?? receivedType;
            if (/^[A-Z]/.test(issue.expected)) {
              return `Input non valido: atteso instanceof ${issue.expected}, ricevuto ${received}`;
            }
            return `Input non valido: atteso ${expected}, ricevuto ${received}`;
          }
          case "invalid_value":
            if (issue.values.length === 1)
              return `Input non valido: atteso ${util.stringifyPrimitive(issue.values[0])}`;
            return `Opzione non valida: atteso uno tra ${util.joinValues(issue.values, "|")}`;
          case "too_big": {
            const adj = issue.inclusive ? "<=" : "<";
            const sizing = getSizing(issue.origin);
            if (sizing)
              return `Troppo grande: ${issue.origin ?? "valore"} deve avere ${adj}${issue.maximum.toString()} ${sizing.unit ?? "elementi"}`;
            return `Troppo grande: ${issue.origin ?? "valore"} deve essere ${adj}${issue.maximum.toString()}`;
          }
          case "too_small": {
            const adj = issue.inclusive ? ">=" : ">";
            const sizing = getSizing(issue.origin);
            if (sizing) {
              return `Troppo piccolo: ${issue.origin} deve avere ${adj}${issue.minimum.toString()} ${sizing.unit}`;
            }
            return `Troppo piccolo: ${issue.origin} deve essere ${adj}${issue.minimum.toString()}`;
          }
          case "invalid_format": {
            const _issue = issue;
            if (_issue.format === "starts_with")
              return `Stringa non valida: deve iniziare con "${_issue.prefix}"`;
            if (_issue.format === "ends_with")
              return `Stringa non valida: deve terminare con "${_issue.suffix}"`;
            if (_issue.format === "includes")
              return `Stringa non valida: deve includere "${_issue.includes}"`;
            if (_issue.format === "regex")
              return `Stringa non valida: deve corrispondere al pattern ${_issue.pattern}`;
            return `Invalid ${FormatDictionary[_issue.format] ?? issue.format}`;
          }
          case "not_multiple_of":
            return `Numero non valido: deve essere un multiplo di ${issue.divisor}`;
          case "unrecognized_keys":
            return `Chiav${issue.keys.length > 1 ? "i" : "e"} non riconosciut${issue.keys.length > 1 ? "e" : "a"}: ${util.joinValues(issue.keys, ", ")}`;
          case "invalid_key":
            return `Chiave non valida in ${issue.origin}`;
          case "invalid_union":
            return "Input non valido";
          case "invalid_element":
            return `Valore non valido in ${issue.origin}`;
          default:
            return `Input non valido`;
        }
      };
    }, "error");
    function default_1() {
      return {
        localeError: error()
      };
    }
    __name(default_1, "default_1");
    module2.exports = exports2.default;
  }
});

// node_modules/zod/v4/locales/ja.cjs
var require_ja = __commonJS({
  "node_modules/zod/v4/locales/ja.cjs"(exports2, module2) {
    "use strict";
    var __createBinding = exports2 && exports2.__createBinding || (Object.create ? (function(o, m, k, k2) {
      if (k2 === void 0) k2 = k;
      var desc = Object.getOwnPropertyDescriptor(m, k);
      if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
        desc = { enumerable: true, get: /* @__PURE__ */ __name(function() {
          return m[k];
        }, "get") };
      }
      Object.defineProperty(o, k2, desc);
    }) : (function(o, m, k, k2) {
      if (k2 === void 0) k2 = k;
      o[k2] = m[k];
    }));
    var __setModuleDefault = exports2 && exports2.__setModuleDefault || (Object.create ? (function(o, v) {
      Object.defineProperty(o, "default", { enumerable: true, value: v });
    }) : function(o, v) {
      o["default"] = v;
    });
    var __importStar = exports2 && exports2.__importStar || function(mod) {
      if (mod && mod.__esModule) return mod;
      var result = {};
      if (mod != null) {
        for (var k in mod) if (k !== "default" && Object.prototype.hasOwnProperty.call(mod, k)) __createBinding(result, mod, k);
      }
      __setModuleDefault(result, mod);
      return result;
    };
    Object.defineProperty(exports2, "__esModule", { value: true });
    exports2.default = default_1;
    var util = __importStar(require_util());
    var error = /* @__PURE__ */ __name(() => {
      const Sizable = {
        string: { unit: "\u6587\u5B57", verb: "\u3067\u3042\u308B" },
        file: { unit: "\u30D0\u30A4\u30C8", verb: "\u3067\u3042\u308B" },
        array: { unit: "\u8981\u7D20", verb: "\u3067\u3042\u308B" },
        set: { unit: "\u8981\u7D20", verb: "\u3067\u3042\u308B" }
      };
      function getSizing(origin) {
        return Sizable[origin] ?? null;
      }
      __name(getSizing, "getSizing");
      const FormatDictionary = {
        regex: "\u5165\u529B\u5024",
        email: "\u30E1\u30FC\u30EB\u30A2\u30C9\u30EC\u30B9",
        url: "URL",
        emoji: "\u7D75\u6587\u5B57",
        uuid: "UUID",
        uuidv4: "UUIDv4",
        uuidv6: "UUIDv6",
        nanoid: "nanoid",
        guid: "GUID",
        cuid: "cuid",
        cuid2: "cuid2",
        ulid: "ULID",
        xid: "XID",
        ksuid: "KSUID",
        datetime: "ISO\u65E5\u6642",
        date: "ISO\u65E5\u4ED8",
        time: "ISO\u6642\u523B",
        duration: "ISO\u671F\u9593",
        ipv4: "IPv4\u30A2\u30C9\u30EC\u30B9",
        ipv6: "IPv6\u30A2\u30C9\u30EC\u30B9",
        cidrv4: "IPv4\u7BC4\u56F2",
        cidrv6: "IPv6\u7BC4\u56F2",
        base64: "base64\u30A8\u30F3\u30B3\u30FC\u30C9\u6587\u5B57\u5217",
        base64url: "base64url\u30A8\u30F3\u30B3\u30FC\u30C9\u6587\u5B57\u5217",
        json_string: "JSON\u6587\u5B57\u5217",
        e164: "E.164\u756A\u53F7",
        jwt: "JWT",
        template_literal: "\u5165\u529B\u5024"
      };
      const TypeDictionary = {
        nan: "NaN",
        number: "\u6570\u5024",
        array: "\u914D\u5217"
      };
      return (issue) => {
        switch (issue.code) {
          case "invalid_type": {
            const expected = TypeDictionary[issue.expected] ?? issue.expected;
            const receivedType = util.parsedType(issue.input);
            const received = TypeDictionary[receivedType] ?? receivedType;
            if (/^[A-Z]/.test(issue.expected)) {
              return `\u7121\u52B9\u306A\u5165\u529B: instanceof ${issue.expected}\u304C\u671F\u5F85\u3055\u308C\u307E\u3057\u305F\u304C\u3001${received}\u304C\u5165\u529B\u3055\u308C\u307E\u3057\u305F`;
            }
            return `\u7121\u52B9\u306A\u5165\u529B: ${expected}\u304C\u671F\u5F85\u3055\u308C\u307E\u3057\u305F\u304C\u3001${received}\u304C\u5165\u529B\u3055\u308C\u307E\u3057\u305F`;
          }
          case "invalid_value":
            if (issue.values.length === 1)
              return `\u7121\u52B9\u306A\u5165\u529B: ${util.stringifyPrimitive(issue.values[0])}\u304C\u671F\u5F85\u3055\u308C\u307E\u3057\u305F`;
            return `\u7121\u52B9\u306A\u9078\u629E: ${util.joinValues(issue.values, "\u3001")}\u306E\u3044\u305A\u308C\u304B\u3067\u3042\u308B\u5FC5\u8981\u304C\u3042\u308A\u307E\u3059`;
          case "too_big": {
            const adj = issue.inclusive ? "\u4EE5\u4E0B\u3067\u3042\u308B" : "\u3088\u308A\u5C0F\u3055\u3044";
            const sizing = getSizing(issue.origin);
            if (sizing)
              return `\u5927\u304D\u3059\u304E\u308B\u5024: ${issue.origin ?? "\u5024"}\u306F${issue.maximum.toString()}${sizing.unit ?? "\u8981\u7D20"}${adj}\u5FC5\u8981\u304C\u3042\u308A\u307E\u3059`;
            return `\u5927\u304D\u3059\u304E\u308B\u5024: ${issue.origin ?? "\u5024"}\u306F${issue.maximum.toString()}${adj}\u5FC5\u8981\u304C\u3042\u308A\u307E\u3059`;
          }
          case "too_small": {
            const adj = issue.inclusive ? "\u4EE5\u4E0A\u3067\u3042\u308B" : "\u3088\u308A\u5927\u304D\u3044";
            const sizing = getSizing(issue.origin);
            if (sizing)
              return `\u5C0F\u3055\u3059\u304E\u308B\u5024: ${issue.origin}\u306F${issue.minimum.toString()}${sizing.unit}${adj}\u5FC5\u8981\u304C\u3042\u308A\u307E\u3059`;
            return `\u5C0F\u3055\u3059\u304E\u308B\u5024: ${issue.origin}\u306F${issue.minimum.toString()}${adj}\u5FC5\u8981\u304C\u3042\u308A\u307E\u3059`;
          }
          case "invalid_format": {
            const _issue = issue;
            if (_issue.format === "starts_with")
              return `\u7121\u52B9\u306A\u6587\u5B57\u5217: "${_issue.prefix}"\u3067\u59CB\u307E\u308B\u5FC5\u8981\u304C\u3042\u308A\u307E\u3059`;
            if (_issue.format === "ends_with")
              return `\u7121\u52B9\u306A\u6587\u5B57\u5217: "${_issue.suffix}"\u3067\u7D42\u308F\u308B\u5FC5\u8981\u304C\u3042\u308A\u307E\u3059`;
            if (_issue.format === "includes")
              return `\u7121\u52B9\u306A\u6587\u5B57\u5217: "${_issue.includes}"\u3092\u542B\u3080\u5FC5\u8981\u304C\u3042\u308A\u307E\u3059`;
            if (_issue.format === "regex")
              return `\u7121\u52B9\u306A\u6587\u5B57\u5217: \u30D1\u30BF\u30FC\u30F3${_issue.pattern}\u306B\u4E00\u81F4\u3059\u308B\u5FC5\u8981\u304C\u3042\u308A\u307E\u3059`;
            return `\u7121\u52B9\u306A${FormatDictionary[_issue.format] ?? issue.format}`;
          }
          case "not_multiple_of":
            return `\u7121\u52B9\u306A\u6570\u5024: ${issue.divisor}\u306E\u500D\u6570\u3067\u3042\u308B\u5FC5\u8981\u304C\u3042\u308A\u307E\u3059`;
          case "unrecognized_keys":
            return `\u8A8D\u8B58\u3055\u308C\u3066\u3044\u306A\u3044\u30AD\u30FC${issue.keys.length > 1 ? "\u7FA4" : ""}: ${util.joinValues(issue.keys, "\u3001")}`;
          case "invalid_key":
            return `${issue.origin}\u5185\u306E\u7121\u52B9\u306A\u30AD\u30FC`;
          case "invalid_union":
            return "\u7121\u52B9\u306A\u5165\u529B";
          case "invalid_element":
            return `${issue.origin}\u5185\u306E\u7121\u52B9\u306A\u5024`;
          default:
            return `\u7121\u52B9\u306A\u5165\u529B`;
        }
      };
    }, "error");
    function default_1() {
      return {
        localeError: error()
      };
    }
    __name(default_1, "default_1");
    module2.exports = exports2.default;
  }
});

// node_modules/zod/v4/locales/ka.cjs
var require_ka = __commonJS({
  "node_modules/zod/v4/locales/ka.cjs"(exports2, module2) {
    "use strict";
    var __createBinding = exports2 && exports2.__createBinding || (Object.create ? (function(o, m, k, k2) {
      if (k2 === void 0) k2 = k;
      var desc = Object.getOwnPropertyDescriptor(m, k);
      if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
        desc = { enumerable: true, get: /* @__PURE__ */ __name(function() {
          return m[k];
        }, "get") };
      }
      Object.defineProperty(o, k2, desc);
    }) : (function(o, m, k, k2) {
      if (k2 === void 0) k2 = k;
      o[k2] = m[k];
    }));
    var __setModuleDefault = exports2 && exports2.__setModuleDefault || (Object.create ? (function(o, v) {
      Object.defineProperty(o, "default", { enumerable: true, value: v });
    }) : function(o, v) {
      o["default"] = v;
    });
    var __importStar = exports2 && exports2.__importStar || function(mod) {
      if (mod && mod.__esModule) return mod;
      var result = {};
      if (mod != null) {
        for (var k in mod) if (k !== "default" && Object.prototype.hasOwnProperty.call(mod, k)) __createBinding(result, mod, k);
      }
      __setModuleDefault(result, mod);
      return result;
    };
    Object.defineProperty(exports2, "__esModule", { value: true });
    exports2.default = default_1;
    var util = __importStar(require_util());
    var error = /* @__PURE__ */ __name(() => {
      const Sizable = {
        string: { unit: "\u10E1\u10D8\u10DB\u10D1\u10DD\u10DA\u10DD", verb: "\u10E3\u10DC\u10D3\u10D0 \u10E8\u10D4\u10D8\u10EA\u10D0\u10D5\u10D3\u10D4\u10E1" },
        file: { unit: "\u10D1\u10D0\u10D8\u10E2\u10D8", verb: "\u10E3\u10DC\u10D3\u10D0 \u10E8\u10D4\u10D8\u10EA\u10D0\u10D5\u10D3\u10D4\u10E1" },
        array: { unit: "\u10D4\u10DA\u10D4\u10DB\u10D4\u10DC\u10E2\u10D8", verb: "\u10E3\u10DC\u10D3\u10D0 \u10E8\u10D4\u10D8\u10EA\u10D0\u10D5\u10D3\u10D4\u10E1" },
        set: { unit: "\u10D4\u10DA\u10D4\u10DB\u10D4\u10DC\u10E2\u10D8", verb: "\u10E3\u10DC\u10D3\u10D0 \u10E8\u10D4\u10D8\u10EA\u10D0\u10D5\u10D3\u10D4\u10E1" }
      };
      function getSizing(origin) {
        return Sizable[origin] ?? null;
      }
      __name(getSizing, "getSizing");
      const FormatDictionary = {
        regex: "\u10E8\u10D4\u10E7\u10D5\u10D0\u10DC\u10D0",
        email: "\u10D4\u10DA-\u10E4\u10DD\u10E1\u10E2\u10D8\u10E1 \u10DB\u10D8\u10E1\u10D0\u10DB\u10D0\u10E0\u10D7\u10D8",
        url: "URL",
        emoji: "\u10D4\u10DB\u10DD\u10EF\u10D8",
        uuid: "UUID",
        uuidv4: "UUIDv4",
        uuidv6: "UUIDv6",
        nanoid: "nanoid",
        guid: "GUID",
        cuid: "cuid",
        cuid2: "cuid2",
        ulid: "ULID",
        xid: "XID",
        ksuid: "KSUID",
        datetime: "\u10D7\u10D0\u10E0\u10D8\u10E6\u10D8-\u10D3\u10E0\u10DD",
        date: "\u10D7\u10D0\u10E0\u10D8\u10E6\u10D8",
        time: "\u10D3\u10E0\u10DD",
        duration: "\u10EE\u10D0\u10DC\u10D2\u10E0\u10EB\u10DA\u10D8\u10D5\u10DD\u10D1\u10D0",
        ipv4: "IPv4 \u10DB\u10D8\u10E1\u10D0\u10DB\u10D0\u10E0\u10D7\u10D8",
        ipv6: "IPv6 \u10DB\u10D8\u10E1\u10D0\u10DB\u10D0\u10E0\u10D7\u10D8",
        cidrv4: "IPv4 \u10D3\u10D8\u10D0\u10DE\u10D0\u10D6\u10DD\u10DC\u10D8",
        cidrv6: "IPv6 \u10D3\u10D8\u10D0\u10DE\u10D0\u10D6\u10DD\u10DC\u10D8",
        base64: "base64-\u10D9\u10DD\u10D3\u10D8\u10E0\u10D4\u10D1\u10E3\u10DA\u10D8 \u10E1\u10E2\u10E0\u10D8\u10DC\u10D2\u10D8",
        base64url: "base64url-\u10D9\u10DD\u10D3\u10D8\u10E0\u10D4\u10D1\u10E3\u10DA\u10D8 \u10E1\u10E2\u10E0\u10D8\u10DC\u10D2\u10D8",
        json_string: "JSON \u10E1\u10E2\u10E0\u10D8\u10DC\u10D2\u10D8",
        e164: "E.164 \u10DC\u10DD\u10DB\u10D4\u10E0\u10D8",
        jwt: "JWT",
        template_literal: "\u10E8\u10D4\u10E7\u10D5\u10D0\u10DC\u10D0"
      };
      const TypeDictionary = {
        nan: "NaN",
        number: "\u10E0\u10D8\u10EA\u10EE\u10D5\u10D8",
        string: "\u10E1\u10E2\u10E0\u10D8\u10DC\u10D2\u10D8",
        boolean: "\u10D1\u10E3\u10DA\u10D4\u10D0\u10DC\u10D8",
        function: "\u10E4\u10E3\u10DC\u10E5\u10EA\u10D8\u10D0",
        array: "\u10DB\u10D0\u10E1\u10D8\u10D5\u10D8"
      };
      return (issue) => {
        switch (issue.code) {
          case "invalid_type": {
            const expected = TypeDictionary[issue.expected] ?? issue.expected;
            const receivedType = util.parsedType(issue.input);
            const received = TypeDictionary[receivedType] ?? receivedType;
            if (/^[A-Z]/.test(issue.expected)) {
              return `\u10D0\u10E0\u10D0\u10E1\u10EC\u10DD\u10E0\u10D8 \u10E8\u10D4\u10E7\u10D5\u10D0\u10DC\u10D0: \u10DB\u10DD\u10E1\u10D0\u10DA\u10DD\u10D3\u10DC\u10D4\u10DA\u10D8 instanceof ${issue.expected}, \u10DB\u10D8\u10E6\u10D4\u10D1\u10E3\u10DA\u10D8 ${received}`;
            }
            return `\u10D0\u10E0\u10D0\u10E1\u10EC\u10DD\u10E0\u10D8 \u10E8\u10D4\u10E7\u10D5\u10D0\u10DC\u10D0: \u10DB\u10DD\u10E1\u10D0\u10DA\u10DD\u10D3\u10DC\u10D4\u10DA\u10D8 ${expected}, \u10DB\u10D8\u10E6\u10D4\u10D1\u10E3\u10DA\u10D8 ${received}`;
          }
          case "invalid_value":
            if (issue.values.length === 1)
              return `\u10D0\u10E0\u10D0\u10E1\u10EC\u10DD\u10E0\u10D8 \u10E8\u10D4\u10E7\u10D5\u10D0\u10DC\u10D0: \u10DB\u10DD\u10E1\u10D0\u10DA\u10DD\u10D3\u10DC\u10D4\u10DA\u10D8 ${util.stringifyPrimitive(issue.values[0])}`;
            return `\u10D0\u10E0\u10D0\u10E1\u10EC\u10DD\u10E0\u10D8 \u10D5\u10D0\u10E0\u10D8\u10D0\u10DC\u10E2\u10D8: \u10DB\u10DD\u10E1\u10D0\u10DA\u10DD\u10D3\u10DC\u10D4\u10DA\u10D8\u10D0 \u10D4\u10E0\u10D7-\u10D4\u10E0\u10D7\u10D8 ${util.joinValues(issue.values, "|")}-\u10D3\u10D0\u10DC`;
          case "too_big": {
            const adj = issue.inclusive ? "<=" : "<";
            const sizing = getSizing(issue.origin);
            if (sizing)
              return `\u10D6\u10D4\u10D3\u10DB\u10D4\u10E2\u10D0\u10D3 \u10D3\u10D8\u10D3\u10D8: \u10DB\u10DD\u10E1\u10D0\u10DA\u10DD\u10D3\u10DC\u10D4\u10DA\u10D8 ${issue.origin ?? "\u10DB\u10DC\u10D8\u10E8\u10D5\u10DC\u10D4\u10DA\u10DD\u10D1\u10D0"} ${sizing.verb} ${adj}${issue.maximum.toString()} ${sizing.unit}`;
            return `\u10D6\u10D4\u10D3\u10DB\u10D4\u10E2\u10D0\u10D3 \u10D3\u10D8\u10D3\u10D8: \u10DB\u10DD\u10E1\u10D0\u10DA\u10DD\u10D3\u10DC\u10D4\u10DA\u10D8 ${issue.origin ?? "\u10DB\u10DC\u10D8\u10E8\u10D5\u10DC\u10D4\u10DA\u10DD\u10D1\u10D0"} \u10D8\u10E7\u10DD\u10E1 ${adj}${issue.maximum.toString()}`;
          }
          case "too_small": {
            const adj = issue.inclusive ? ">=" : ">";
            const sizing = getSizing(issue.origin);
            if (sizing) {
              return `\u10D6\u10D4\u10D3\u10DB\u10D4\u10E2\u10D0\u10D3 \u10DE\u10D0\u10E2\u10D0\u10E0\u10D0: \u10DB\u10DD\u10E1\u10D0\u10DA\u10DD\u10D3\u10DC\u10D4\u10DA\u10D8 ${issue.origin} ${sizing.verb} ${adj}${issue.minimum.toString()} ${sizing.unit}`;
            }
            return `\u10D6\u10D4\u10D3\u10DB\u10D4\u10E2\u10D0\u10D3 \u10DE\u10D0\u10E2\u10D0\u10E0\u10D0: \u10DB\u10DD\u10E1\u10D0\u10DA\u10DD\u10D3\u10DC\u10D4\u10DA\u10D8 ${issue.origin} \u10D8\u10E7\u10DD\u10E1 ${adj}${issue.minimum.toString()}`;
          }
          case "invalid_format": {
            const _issue = issue;
            if (_issue.format === "starts_with") {
              return `\u10D0\u10E0\u10D0\u10E1\u10EC\u10DD\u10E0\u10D8 \u10E1\u10E2\u10E0\u10D8\u10DC\u10D2\u10D8: \u10E3\u10DC\u10D3\u10D0 \u10D8\u10EC\u10E7\u10D4\u10D1\u10DD\u10D3\u10D4\u10E1 "${_issue.prefix}"-\u10D8\u10D7`;
            }
            if (_issue.format === "ends_with")
              return `\u10D0\u10E0\u10D0\u10E1\u10EC\u10DD\u10E0\u10D8 \u10E1\u10E2\u10E0\u10D8\u10DC\u10D2\u10D8: \u10E3\u10DC\u10D3\u10D0 \u10DB\u10D7\u10D0\u10D5\u10E0\u10D3\u10D4\u10D1\u10DD\u10D3\u10D4\u10E1 "${_issue.suffix}"-\u10D8\u10D7`;
            if (_issue.format === "includes")
              return `\u10D0\u10E0\u10D0\u10E1\u10EC\u10DD\u10E0\u10D8 \u10E1\u10E2\u10E0\u10D8\u10DC\u10D2\u10D8: \u10E3\u10DC\u10D3\u10D0 \u10E8\u10D4\u10D8\u10EA\u10D0\u10D5\u10D3\u10D4\u10E1 "${_issue.includes}"-\u10E1`;
            if (_issue.format === "regex")
              return `\u10D0\u10E0\u10D0\u10E1\u10EC\u10DD\u10E0\u10D8 \u10E1\u10E2\u10E0\u10D8\u10DC\u10D2\u10D8: \u10E3\u10DC\u10D3\u10D0 \u10E8\u10D4\u10D4\u10E1\u10D0\u10D1\u10D0\u10DB\u10D4\u10D1\u10DD\u10D3\u10D4\u10E1 \u10E8\u10D0\u10D1\u10DA\u10DD\u10DC\u10E1 ${_issue.pattern}`;
            return `\u10D0\u10E0\u10D0\u10E1\u10EC\u10DD\u10E0\u10D8 ${FormatDictionary[_issue.format] ?? issue.format}`;
          }
          case "not_multiple_of":
            return `\u10D0\u10E0\u10D0\u10E1\u10EC\u10DD\u10E0\u10D8 \u10E0\u10D8\u10EA\u10EE\u10D5\u10D8: \u10E3\u10DC\u10D3\u10D0 \u10D8\u10E7\u10DD\u10E1 ${issue.divisor}-\u10D8\u10E1 \u10EF\u10D4\u10E0\u10D0\u10D3\u10D8`;
          case "unrecognized_keys":
            return `\u10E3\u10EA\u10DC\u10DD\u10D1\u10D8 \u10D2\u10D0\u10E1\u10D0\u10E6\u10D4\u10D1${issue.keys.length > 1 ? "\u10D4\u10D1\u10D8" : "\u10D8"}: ${util.joinValues(issue.keys, ", ")}`;
          case "invalid_key":
            return `\u10D0\u10E0\u10D0\u10E1\u10EC\u10DD\u10E0\u10D8 \u10D2\u10D0\u10E1\u10D0\u10E6\u10D4\u10D1\u10D8 ${issue.origin}-\u10E8\u10D8`;
          case "invalid_union":
            return "\u10D0\u10E0\u10D0\u10E1\u10EC\u10DD\u10E0\u10D8 \u10E8\u10D4\u10E7\u10D5\u10D0\u10DC\u10D0";
          case "invalid_element":
            return `\u10D0\u10E0\u10D0\u10E1\u10EC\u10DD\u10E0\u10D8 \u10DB\u10DC\u10D8\u10E8\u10D5\u10DC\u10D4\u10DA\u10DD\u10D1\u10D0 ${issue.origin}-\u10E8\u10D8`;
          default:
            return `\u10D0\u10E0\u10D0\u10E1\u10EC\u10DD\u10E0\u10D8 \u10E8\u10D4\u10E7\u10D5\u10D0\u10DC\u10D0`;
        }
      };
    }, "error");
    function default_1() {
      return {
        localeError: error()
      };
    }
    __name(default_1, "default_1");
    module2.exports = exports2.default;
  }
});

// node_modules/zod/v4/locales/km.cjs
var require_km = __commonJS({
  "node_modules/zod/v4/locales/km.cjs"(exports2, module2) {
    "use strict";
    var __createBinding = exports2 && exports2.__createBinding || (Object.create ? (function(o, m, k, k2) {
      if (k2 === void 0) k2 = k;
      var desc = Object.getOwnPropertyDescriptor(m, k);
      if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
        desc = { enumerable: true, get: /* @__PURE__ */ __name(function() {
          return m[k];
        }, "get") };
      }
      Object.defineProperty(o, k2, desc);
    }) : (function(o, m, k, k2) {
      if (k2 === void 0) k2 = k;
      o[k2] = m[k];
    }));
    var __setModuleDefault = exports2 && exports2.__setModuleDefault || (Object.create ? (function(o, v) {
      Object.defineProperty(o, "default", { enumerable: true, value: v });
    }) : function(o, v) {
      o["default"] = v;
    });
    var __importStar = exports2 && exports2.__importStar || function(mod) {
      if (mod && mod.__esModule) return mod;
      var result = {};
      if (mod != null) {
        for (var k in mod) if (k !== "default" && Object.prototype.hasOwnProperty.call(mod, k)) __createBinding(result, mod, k);
      }
      __setModuleDefault(result, mod);
      return result;
    };
    Object.defineProperty(exports2, "__esModule", { value: true });
    exports2.default = default_1;
    var util = __importStar(require_util());
    var error = /* @__PURE__ */ __name(() => {
      const Sizable = {
        string: { unit: "\u178F\u17BD\u17A2\u1780\u17D2\u179F\u179A", verb: "\u1782\u17BD\u179A\u1798\u17B6\u1793" },
        file: { unit: "\u1794\u17C3", verb: "\u1782\u17BD\u179A\u1798\u17B6\u1793" },
        array: { unit: "\u1792\u17B6\u178F\u17BB", verb: "\u1782\u17BD\u179A\u1798\u17B6\u1793" },
        set: { unit: "\u1792\u17B6\u178F\u17BB", verb: "\u1782\u17BD\u179A\u1798\u17B6\u1793" }
      };
      function getSizing(origin) {
        return Sizable[origin] ?? null;
      }
      __name(getSizing, "getSizing");
      const FormatDictionary = {
        regex: "\u1791\u17B7\u1793\u17D2\u1793\u1793\u17D0\u1799\u1794\u1789\u17D2\u1785\u17BC\u179B",
        email: "\u17A2\u17B6\u179F\u1799\u178A\u17D2\u178B\u17B6\u1793\u17A2\u17CA\u17B8\u1798\u17C2\u179B",
        url: "URL",
        emoji: "\u179F\u1789\u17D2\u1789\u17B6\u17A2\u17B6\u179A\u1798\u17D2\u1798\u178E\u17CD",
        uuid: "UUID",
        uuidv4: "UUIDv4",
        uuidv6: "UUIDv6",
        nanoid: "nanoid",
        guid: "GUID",
        cuid: "cuid",
        cuid2: "cuid2",
        ulid: "ULID",
        xid: "XID",
        ksuid: "KSUID",
        datetime: "\u1780\u17B6\u179B\u1794\u179A\u17B7\u1785\u17D2\u1786\u17C1\u1791 \u1793\u17B7\u1784\u1798\u17C9\u17C4\u1784 ISO",
        date: "\u1780\u17B6\u179B\u1794\u179A\u17B7\u1785\u17D2\u1786\u17C1\u1791 ISO",
        time: "\u1798\u17C9\u17C4\u1784 ISO",
        duration: "\u179A\u1799\u17C8\u1796\u17C1\u179B ISO",
        ipv4: "\u17A2\u17B6\u179F\u1799\u178A\u17D2\u178B\u17B6\u1793 IPv4",
        ipv6: "\u17A2\u17B6\u179F\u1799\u178A\u17D2\u178B\u17B6\u1793 IPv6",
        cidrv4: "\u178A\u17C2\u1793\u17A2\u17B6\u179F\u1799\u178A\u17D2\u178B\u17B6\u1793 IPv4",
        cidrv6: "\u178A\u17C2\u1793\u17A2\u17B6\u179F\u1799\u178A\u17D2\u178B\u17B6\u1793 IPv6",
        base64: "\u1781\u17D2\u179F\u17C2\u17A2\u1780\u17D2\u179F\u179A\u17A2\u17CA\u17B7\u1780\u17BC\u178A base64",
        base64url: "\u1781\u17D2\u179F\u17C2\u17A2\u1780\u17D2\u179F\u179A\u17A2\u17CA\u17B7\u1780\u17BC\u178A base64url",
        json_string: "\u1781\u17D2\u179F\u17C2\u17A2\u1780\u17D2\u179F\u179A JSON",
        e164: "\u179B\u17C1\u1781 E.164",
        jwt: "JWT",
        template_literal: "\u1791\u17B7\u1793\u17D2\u1793\u1793\u17D0\u1799\u1794\u1789\u17D2\u1785\u17BC\u179B"
      };
      const TypeDictionary = {
        nan: "NaN",
        number: "\u179B\u17C1\u1781",
        array: "\u17A2\u17B6\u179A\u17C1 (Array)",
        null: "\u1782\u17D2\u1798\u17B6\u1793\u178F\u1798\u17D2\u179B\u17C3 (null)"
      };
      return (issue) => {
        switch (issue.code) {
          case "invalid_type": {
            const expected = TypeDictionary[issue.expected] ?? issue.expected;
            const receivedType = util.parsedType(issue.input);
            const received = TypeDictionary[receivedType] ?? receivedType;
            if (/^[A-Z]/.test(issue.expected)) {
              return `\u1791\u17B7\u1793\u17D2\u1793\u1793\u17D0\u1799\u1794\u1789\u17D2\u1785\u17BC\u179B\u1798\u17B7\u1793\u178F\u17D2\u179A\u17B9\u1798\u178F\u17D2\u179A\u17BC\u179C\u17D6 \u178F\u17D2\u179A\u17BC\u179C\u1780\u17B6\u179A instanceof ${issue.expected} \u1794\u17C9\u17BB\u1793\u17D2\u178F\u17C2\u1791\u1791\u17BD\u179B\u1794\u17B6\u1793 ${received}`;
            }
            return `\u1791\u17B7\u1793\u17D2\u1793\u1793\u17D0\u1799\u1794\u1789\u17D2\u1785\u17BC\u179B\u1798\u17B7\u1793\u178F\u17D2\u179A\u17B9\u1798\u178F\u17D2\u179A\u17BC\u179C\u17D6 \u178F\u17D2\u179A\u17BC\u179C\u1780\u17B6\u179A ${expected} \u1794\u17C9\u17BB\u1793\u17D2\u178F\u17C2\u1791\u1791\u17BD\u179B\u1794\u17B6\u1793 ${received}`;
          }
          case "invalid_value":
            if (issue.values.length === 1)
              return `\u1791\u17B7\u1793\u17D2\u1793\u1793\u17D0\u1799\u1794\u1789\u17D2\u1785\u17BC\u179B\u1798\u17B7\u1793\u178F\u17D2\u179A\u17B9\u1798\u178F\u17D2\u179A\u17BC\u179C\u17D6 \u178F\u17D2\u179A\u17BC\u179C\u1780\u17B6\u179A ${util.stringifyPrimitive(issue.values[0])}`;
            return `\u1787\u1798\u17D2\u179A\u17BE\u179F\u1798\u17B7\u1793\u178F\u17D2\u179A\u17B9\u1798\u178F\u17D2\u179A\u17BC\u179C\u17D6 \u178F\u17D2\u179A\u17BC\u179C\u1787\u17B6\u1798\u17BD\u1799\u1780\u17D2\u1793\u17BB\u1784\u1785\u17C6\u178E\u17C4\u1798 ${util.joinValues(issue.values, "|")}`;
          case "too_big": {
            const adj = issue.inclusive ? "<=" : "<";
            const sizing = getSizing(issue.origin);
            if (sizing)
              return `\u1792\u17C6\u1796\u17C1\u1780\u17D6 \u178F\u17D2\u179A\u17BC\u179C\u1780\u17B6\u179A ${issue.origin ?? "\u178F\u1798\u17D2\u179B\u17C3"} ${adj} ${issue.maximum.toString()} ${sizing.unit ?? "\u1792\u17B6\u178F\u17BB"}`;
            return `\u1792\u17C6\u1796\u17C1\u1780\u17D6 \u178F\u17D2\u179A\u17BC\u179C\u1780\u17B6\u179A ${issue.origin ?? "\u178F\u1798\u17D2\u179B\u17C3"} ${adj} ${issue.maximum.toString()}`;
          }
          case "too_small": {
            const adj = issue.inclusive ? ">=" : ">";
            const sizing = getSizing(issue.origin);
            if (sizing) {
              return `\u178F\u17BC\u1785\u1796\u17C1\u1780\u17D6 \u178F\u17D2\u179A\u17BC\u179C\u1780\u17B6\u179A ${issue.origin} ${adj} ${issue.minimum.toString()} ${sizing.unit}`;
            }
            return `\u178F\u17BC\u1785\u1796\u17C1\u1780\u17D6 \u178F\u17D2\u179A\u17BC\u179C\u1780\u17B6\u179A ${issue.origin} ${adj} ${issue.minimum.toString()}`;
          }
          case "invalid_format": {
            const _issue = issue;
            if (_issue.format === "starts_with") {
              return `\u1781\u17D2\u179F\u17C2\u17A2\u1780\u17D2\u179F\u179A\u1798\u17B7\u1793\u178F\u17D2\u179A\u17B9\u1798\u178F\u17D2\u179A\u17BC\u179C\u17D6 \u178F\u17D2\u179A\u17BC\u179C\u1785\u17B6\u1794\u17CB\u1795\u17D2\u178F\u17BE\u1798\u178A\u17C4\u1799 "${_issue.prefix}"`;
            }
            if (_issue.format === "ends_with")
              return `\u1781\u17D2\u179F\u17C2\u17A2\u1780\u17D2\u179F\u179A\u1798\u17B7\u1793\u178F\u17D2\u179A\u17B9\u1798\u178F\u17D2\u179A\u17BC\u179C\u17D6 \u178F\u17D2\u179A\u17BC\u179C\u1794\u1789\u17D2\u1785\u1794\u17CB\u178A\u17C4\u1799 "${_issue.suffix}"`;
            if (_issue.format === "includes")
              return `\u1781\u17D2\u179F\u17C2\u17A2\u1780\u17D2\u179F\u179A\u1798\u17B7\u1793\u178F\u17D2\u179A\u17B9\u1798\u178F\u17D2\u179A\u17BC\u179C\u17D6 \u178F\u17D2\u179A\u17BC\u179C\u1798\u17B6\u1793 "${_issue.includes}"`;
            if (_issue.format === "regex")
              return `\u1781\u17D2\u179F\u17C2\u17A2\u1780\u17D2\u179F\u179A\u1798\u17B7\u1793\u178F\u17D2\u179A\u17B9\u1798\u178F\u17D2\u179A\u17BC\u179C\u17D6 \u178F\u17D2\u179A\u17BC\u179C\u178F\u17C2\u1795\u17D2\u1782\u17BC\u1795\u17D2\u1782\u1784\u1793\u17B9\u1784\u1791\u1798\u17D2\u179A\u1784\u17CB\u178A\u17C2\u179B\u1794\u17B6\u1793\u1780\u17C6\u178E\u178F\u17CB ${_issue.pattern}`;
            return `\u1798\u17B7\u1793\u178F\u17D2\u179A\u17B9\u1798\u178F\u17D2\u179A\u17BC\u179C\u17D6 ${FormatDictionary[_issue.format] ?? issue.format}`;
          }
          case "not_multiple_of":
            return `\u179B\u17C1\u1781\u1798\u17B7\u1793\u178F\u17D2\u179A\u17B9\u1798\u178F\u17D2\u179A\u17BC\u179C\u17D6 \u178F\u17D2\u179A\u17BC\u179C\u178F\u17C2\u1787\u17B6\u1796\u17A0\u17BB\u1782\u17BB\u178E\u1793\u17C3 ${issue.divisor}`;
          case "unrecognized_keys":
            return `\u179A\u1780\u1783\u17BE\u1789\u179F\u17C4\u1798\u17B7\u1793\u179F\u17D2\u1782\u17B6\u179B\u17CB\u17D6 ${util.joinValues(issue.keys, ", ")}`;
          case "invalid_key":
            return `\u179F\u17C4\u1798\u17B7\u1793\u178F\u17D2\u179A\u17B9\u1798\u178F\u17D2\u179A\u17BC\u179C\u1793\u17C5\u1780\u17D2\u1793\u17BB\u1784 ${issue.origin}`;
          case "invalid_union":
            return `\u1791\u17B7\u1793\u17D2\u1793\u1793\u17D0\u1799\u1798\u17B7\u1793\u178F\u17D2\u179A\u17B9\u1798\u178F\u17D2\u179A\u17BC\u179C`;
          case "invalid_element":
            return `\u1791\u17B7\u1793\u17D2\u1793\u1793\u17D0\u1799\u1798\u17B7\u1793\u178F\u17D2\u179A\u17B9\u1798\u178F\u17D2\u179A\u17BC\u179C\u1793\u17C5\u1780\u17D2\u1793\u17BB\u1784 ${issue.origin}`;
          default:
            return `\u1791\u17B7\u1793\u17D2\u1793\u1793\u17D0\u1799\u1798\u17B7\u1793\u178F\u17D2\u179A\u17B9\u1798\u178F\u17D2\u179A\u17BC\u179C`;
        }
      };
    }, "error");
    function default_1() {
      return {
        localeError: error()
      };
    }
    __name(default_1, "default_1");
    module2.exports = exports2.default;
  }
});

// node_modules/zod/v4/locales/kh.cjs
var require_kh = __commonJS({
  "node_modules/zod/v4/locales/kh.cjs"(exports2, module2) {
    "use strict";
    var __importDefault = exports2 && exports2.__importDefault || function(mod) {
      return mod && mod.__esModule ? mod : { "default": mod };
    };
    Object.defineProperty(exports2, "__esModule", { value: true });
    exports2.default = default_1;
    var km_js_1 = __importDefault(require_km());
    function default_1() {
      return (0, km_js_1.default)();
    }
    __name(default_1, "default_1");
    module2.exports = exports2.default;
  }
});

// node_modules/zod/v4/locales/ko.cjs
var require_ko = __commonJS({
  "node_modules/zod/v4/locales/ko.cjs"(exports2, module2) {
    "use strict";
    var __createBinding = exports2 && exports2.__createBinding || (Object.create ? (function(o, m, k, k2) {
      if (k2 === void 0) k2 = k;
      var desc = Object.getOwnPropertyDescriptor(m, k);
      if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
        desc = { enumerable: true, get: /* @__PURE__ */ __name(function() {
          return m[k];
        }, "get") };
      }
      Object.defineProperty(o, k2, desc);
    }) : (function(o, m, k, k2) {
      if (k2 === void 0) k2 = k;
      o[k2] = m[k];
    }));
    var __setModuleDefault = exports2 && exports2.__setModuleDefault || (Object.create ? (function(o, v) {
      Object.defineProperty(o, "default", { enumerable: true, value: v });
    }) : function(o, v) {
      o["default"] = v;
    });
    var __importStar = exports2 && exports2.__importStar || function(mod) {
      if (mod && mod.__esModule) return mod;
      var result = {};
      if (mod != null) {
        for (var k in mod) if (k !== "default" && Object.prototype.hasOwnProperty.call(mod, k)) __createBinding(result, mod, k);
      }
      __setModuleDefault(result, mod);
      return result;
    };
    Object.defineProperty(exports2, "__esModule", { value: true });
    exports2.default = default_1;
    var util = __importStar(require_util());
    var error = /* @__PURE__ */ __name(() => {
      const Sizable = {
        string: { unit: "\uBB38\uC790", verb: "to have" },
        file: { unit: "\uBC14\uC774\uD2B8", verb: "to have" },
        array: { unit: "\uAC1C", verb: "to have" },
        set: { unit: "\uAC1C", verb: "to have" }
      };
      function getSizing(origin) {
        return Sizable[origin] ?? null;
      }
      __name(getSizing, "getSizing");
      const FormatDictionary = {
        regex: "\uC785\uB825",
        email: "\uC774\uBA54\uC77C \uC8FC\uC18C",
        url: "URL",
        emoji: "\uC774\uBAA8\uC9C0",
        uuid: "UUID",
        uuidv4: "UUIDv4",
        uuidv6: "UUIDv6",
        nanoid: "nanoid",
        guid: "GUID",
        cuid: "cuid",
        cuid2: "cuid2",
        ulid: "ULID",
        xid: "XID",
        ksuid: "KSUID",
        datetime: "ISO \uB0A0\uC9DC\uC2DC\uAC04",
        date: "ISO \uB0A0\uC9DC",
        time: "ISO \uC2DC\uAC04",
        duration: "ISO \uAE30\uAC04",
        ipv4: "IPv4 \uC8FC\uC18C",
        ipv6: "IPv6 \uC8FC\uC18C",
        cidrv4: "IPv4 \uBC94\uC704",
        cidrv6: "IPv6 \uBC94\uC704",
        base64: "base64 \uC778\uCF54\uB529 \uBB38\uC790\uC5F4",
        base64url: "base64url \uC778\uCF54\uB529 \uBB38\uC790\uC5F4",
        json_string: "JSON \uBB38\uC790\uC5F4",
        e164: "E.164 \uBC88\uD638",
        jwt: "JWT",
        template_literal: "\uC785\uB825"
      };
      const TypeDictionary = {
        nan: "NaN"
      };
      return (issue) => {
        switch (issue.code) {
          case "invalid_type": {
            const expected = TypeDictionary[issue.expected] ?? issue.expected;
            const receivedType = util.parsedType(issue.input);
            const received = TypeDictionary[receivedType] ?? receivedType;
            if (/^[A-Z]/.test(issue.expected)) {
              return `\uC798\uBABB\uB41C \uC785\uB825: \uC608\uC0C1 \uD0C0\uC785\uC740 instanceof ${issue.expected}, \uBC1B\uC740 \uD0C0\uC785\uC740 ${received}\uC785\uB2C8\uB2E4`;
            }
            return `\uC798\uBABB\uB41C \uC785\uB825: \uC608\uC0C1 \uD0C0\uC785\uC740 ${expected}, \uBC1B\uC740 \uD0C0\uC785\uC740 ${received}\uC785\uB2C8\uB2E4`;
          }
          case "invalid_value":
            if (issue.values.length === 1)
              return `\uC798\uBABB\uB41C \uC785\uB825: \uAC12\uC740 ${util.stringifyPrimitive(issue.values[0])} \uC774\uC5B4\uC57C \uD569\uB2C8\uB2E4`;
            return `\uC798\uBABB\uB41C \uC635\uC158: ${util.joinValues(issue.values, "\uB610\uB294 ")} \uC911 \uD558\uB098\uC5EC\uC57C \uD569\uB2C8\uB2E4`;
          case "too_big": {
            const adj = issue.inclusive ? "\uC774\uD558" : "\uBBF8\uB9CC";
            const suffix = adj === "\uBBF8\uB9CC" ? "\uC774\uC5B4\uC57C \uD569\uB2C8\uB2E4" : "\uC5EC\uC57C \uD569\uB2C8\uB2E4";
            const sizing = getSizing(issue.origin);
            const unit = sizing?.unit ?? "\uC694\uC18C";
            if (sizing)
              return `${issue.origin ?? "\uAC12"}\uC774 \uB108\uBB34 \uD07D\uB2C8\uB2E4: ${issue.maximum.toString()}${unit} ${adj}${suffix}`;
            return `${issue.origin ?? "\uAC12"}\uC774 \uB108\uBB34 \uD07D\uB2C8\uB2E4: ${issue.maximum.toString()} ${adj}${suffix}`;
          }
          case "too_small": {
            const adj = issue.inclusive ? "\uC774\uC0C1" : "\uCD08\uACFC";
            const suffix = adj === "\uC774\uC0C1" ? "\uC774\uC5B4\uC57C \uD569\uB2C8\uB2E4" : "\uC5EC\uC57C \uD569\uB2C8\uB2E4";
            const sizing = getSizing(issue.origin);
            const unit = sizing?.unit ?? "\uC694\uC18C";
            if (sizing) {
              return `${issue.origin ?? "\uAC12"}\uC774 \uB108\uBB34 \uC791\uC2B5\uB2C8\uB2E4: ${issue.minimum.toString()}${unit} ${adj}${suffix}`;
            }
            return `${issue.origin ?? "\uAC12"}\uC774 \uB108\uBB34 \uC791\uC2B5\uB2C8\uB2E4: ${issue.minimum.toString()} ${adj}${suffix}`;
          }
          case "invalid_format": {
            const _issue = issue;
            if (_issue.format === "starts_with") {
              return `\uC798\uBABB\uB41C \uBB38\uC790\uC5F4: "${_issue.prefix}"(\uC73C)\uB85C \uC2DC\uC791\uD574\uC57C \uD569\uB2C8\uB2E4`;
            }
            if (_issue.format === "ends_with")
              return `\uC798\uBABB\uB41C \uBB38\uC790\uC5F4: "${_issue.suffix}"(\uC73C)\uB85C \uB05D\uB098\uC57C \uD569\uB2C8\uB2E4`;
            if (_issue.format === "includes")
              return `\uC798\uBABB\uB41C \uBB38\uC790\uC5F4: "${_issue.includes}"\uC744(\uB97C) \uD3EC\uD568\uD574\uC57C \uD569\uB2C8\uB2E4`;
            if (_issue.format === "regex")
              return `\uC798\uBABB\uB41C \uBB38\uC790\uC5F4: \uC815\uADDC\uC2DD ${_issue.pattern} \uD328\uD134\uACFC \uC77C\uCE58\uD574\uC57C \uD569\uB2C8\uB2E4`;
            return `\uC798\uBABB\uB41C ${FormatDictionary[_issue.format] ?? issue.format}`;
          }
          case "not_multiple_of":
            return `\uC798\uBABB\uB41C \uC22B\uC790: ${issue.divisor}\uC758 \uBC30\uC218\uC5EC\uC57C \uD569\uB2C8\uB2E4`;
          case "unrecognized_keys":
            return `\uC778\uC2DD\uD560 \uC218 \uC5C6\uB294 \uD0A4: ${util.joinValues(issue.keys, ", ")}`;
          case "invalid_key":
            return `\uC798\uBABB\uB41C \uD0A4: ${issue.origin}`;
          case "invalid_union":
            return `\uC798\uBABB\uB41C \uC785\uB825`;
          case "invalid_element":
            return `\uC798\uBABB\uB41C \uAC12: ${issue.origin}`;
          default:
            return `\uC798\uBABB\uB41C \uC785\uB825`;
        }
      };
    }, "error");
    function default_1() {
      return {
        localeError: error()
      };
    }
    __name(default_1, "default_1");
    module2.exports = exports2.default;
  }
});

// node_modules/zod/v4/locales/lt.cjs
var require_lt = __commonJS({
  "node_modules/zod/v4/locales/lt.cjs"(exports2, module2) {
    "use strict";
    var __createBinding = exports2 && exports2.__createBinding || (Object.create ? (function(o, m, k, k2) {
      if (k2 === void 0) k2 = k;
      var desc = Object.getOwnPropertyDescriptor(m, k);
      if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
        desc = { enumerable: true, get: /* @__PURE__ */ __name(function() {
          return m[k];
        }, "get") };
      }
      Object.defineProperty(o, k2, desc);
    }) : (function(o, m, k, k2) {
      if (k2 === void 0) k2 = k;
      o[k2] = m[k];
    }));
    var __setModuleDefault = exports2 && exports2.__setModuleDefault || (Object.create ? (function(o, v) {
      Object.defineProperty(o, "default", { enumerable: true, value: v });
    }) : function(o, v) {
      o["default"] = v;
    });
    var __importStar = exports2 && exports2.__importStar || function(mod) {
      if (mod && mod.__esModule) return mod;
      var result = {};
      if (mod != null) {
        for (var k in mod) if (k !== "default" && Object.prototype.hasOwnProperty.call(mod, k)) __createBinding(result, mod, k);
      }
      __setModuleDefault(result, mod);
      return result;
    };
    Object.defineProperty(exports2, "__esModule", { value: true });
    exports2.default = default_1;
    var util = __importStar(require_util());
    var capitalizeFirstCharacter = /* @__PURE__ */ __name((text) => {
      return text.charAt(0).toUpperCase() + text.slice(1);
    }, "capitalizeFirstCharacter");
    function getUnitTypeFromNumber(number) {
      const abs = Math.abs(number);
      const last = abs % 10;
      const last2 = abs % 100;
      if (last2 >= 11 && last2 <= 19 || last === 0)
        return "many";
      if (last === 1)
        return "one";
      return "few";
    }
    __name(getUnitTypeFromNumber, "getUnitTypeFromNumber");
    var error = /* @__PURE__ */ __name(() => {
      const Sizable = {
        string: {
          unit: {
            one: "simbolis",
            few: "simboliai",
            many: "simboli\u0173"
          },
          verb: {
            smaller: {
              inclusive: "turi b\u016Bti ne ilgesn\u0117 kaip",
              notInclusive: "turi b\u016Bti trumpesn\u0117 kaip"
            },
            bigger: {
              inclusive: "turi b\u016Bti ne trumpesn\u0117 kaip",
              notInclusive: "turi b\u016Bti ilgesn\u0117 kaip"
            }
          }
        },
        file: {
          unit: {
            one: "baitas",
            few: "baitai",
            many: "bait\u0173"
          },
          verb: {
            smaller: {
              inclusive: "turi b\u016Bti ne didesnis kaip",
              notInclusive: "turi b\u016Bti ma\u017Eesnis kaip"
            },
            bigger: {
              inclusive: "turi b\u016Bti ne ma\u017Eesnis kaip",
              notInclusive: "turi b\u016Bti didesnis kaip"
            }
          }
        },
        array: {
          unit: {
            one: "element\u0105",
            few: "elementus",
            many: "element\u0173"
          },
          verb: {
            smaller: {
              inclusive: "turi tur\u0117ti ne daugiau kaip",
              notInclusive: "turi tur\u0117ti ma\u017Eiau kaip"
            },
            bigger: {
              inclusive: "turi tur\u0117ti ne ma\u017Eiau kaip",
              notInclusive: "turi tur\u0117ti daugiau kaip"
            }
          }
        },
        set: {
          unit: {
            one: "element\u0105",
            few: "elementus",
            many: "element\u0173"
          },
          verb: {
            smaller: {
              inclusive: "turi tur\u0117ti ne daugiau kaip",
              notInclusive: "turi tur\u0117ti ma\u017Eiau kaip"
            },
            bigger: {
              inclusive: "turi tur\u0117ti ne ma\u017Eiau kaip",
              notInclusive: "turi tur\u0117ti daugiau kaip"
            }
          }
        }
      };
      function getSizing(origin, unitType, inclusive, targetShouldBe) {
        const result = Sizable[origin] ?? null;
        if (result === null)
          return result;
        return {
          unit: result.unit[unitType],
          verb: result.verb[targetShouldBe][inclusive ? "inclusive" : "notInclusive"]
        };
      }
      __name(getSizing, "getSizing");
      const FormatDictionary = {
        regex: "\u012Fvestis",
        email: "el. pa\u0161to adresas",
        url: "URL",
        emoji: "jaustukas",
        uuid: "UUID",
        uuidv4: "UUIDv4",
        uuidv6: "UUIDv6",
        nanoid: "nanoid",
        guid: "GUID",
        cuid: "cuid",
        cuid2: "cuid2",
        ulid: "ULID",
        xid: "XID",
        ksuid: "KSUID",
        datetime: "ISO data ir laikas",
        date: "ISO data",
        time: "ISO laikas",
        duration: "ISO trukm\u0117",
        ipv4: "IPv4 adresas",
        ipv6: "IPv6 adresas",
        cidrv4: "IPv4 tinklo prefiksas (CIDR)",
        cidrv6: "IPv6 tinklo prefiksas (CIDR)",
        base64: "base64 u\u017Ekoduota eilut\u0117",
        base64url: "base64url u\u017Ekoduota eilut\u0117",
        json_string: "JSON eilut\u0117",
        e164: "E.164 numeris",
        jwt: "JWT",
        template_literal: "\u012Fvestis"
      };
      const TypeDictionary = {
        nan: "NaN",
        number: "skai\u010Dius",
        bigint: "sveikasis skai\u010Dius",
        string: "eilut\u0117",
        boolean: "login\u0117 reik\u0161m\u0117",
        undefined: "neapibr\u0117\u017Eta reik\u0161m\u0117",
        function: "funkcija",
        symbol: "simbolis",
        array: "masyvas",
        object: "objektas",
        null: "nulin\u0117 reik\u0161m\u0117"
      };
      return (issue) => {
        switch (issue.code) {
          case "invalid_type": {
            const expected = TypeDictionary[issue.expected] ?? issue.expected;
            const receivedType = util.parsedType(issue.input);
            const received = TypeDictionary[receivedType] ?? receivedType;
            if (/^[A-Z]/.test(issue.expected)) {
              return `Gautas tipas ${received}, o tik\u0117tasi - instanceof ${issue.expected}`;
            }
            return `Gautas tipas ${received}, o tik\u0117tasi - ${expected}`;
          }
          case "invalid_value":
            if (issue.values.length === 1)
              return `Privalo b\u016Bti ${util.stringifyPrimitive(issue.values[0])}`;
            return `Privalo b\u016Bti vienas i\u0161 ${util.joinValues(issue.values, "|")} pasirinkim\u0173`;
          case "too_big": {
            const origin = TypeDictionary[issue.origin] ?? issue.origin;
            const sizing = getSizing(issue.origin, getUnitTypeFromNumber(Number(issue.maximum)), issue.inclusive ?? false, "smaller");
            if (sizing?.verb)
              return `${capitalizeFirstCharacter(origin ?? issue.origin ?? "reik\u0161m\u0117")} ${sizing.verb} ${issue.maximum.toString()} ${sizing.unit ?? "element\u0173"}`;
            const adj = issue.inclusive ? "ne didesnis kaip" : "ma\u017Eesnis kaip";
            return `${capitalizeFirstCharacter(origin ?? issue.origin ?? "reik\u0161m\u0117")} turi b\u016Bti ${adj} ${issue.maximum.toString()} ${sizing?.unit}`;
          }
          case "too_small": {
            const origin = TypeDictionary[issue.origin] ?? issue.origin;
            const sizing = getSizing(issue.origin, getUnitTypeFromNumber(Number(issue.minimum)), issue.inclusive ?? false, "bigger");
            if (sizing?.verb)
              return `${capitalizeFirstCharacter(origin ?? issue.origin ?? "reik\u0161m\u0117")} ${sizing.verb} ${issue.minimum.toString()} ${sizing.unit ?? "element\u0173"}`;
            const adj = issue.inclusive ? "ne ma\u017Eesnis kaip" : "didesnis kaip";
            return `${capitalizeFirstCharacter(origin ?? issue.origin ?? "reik\u0161m\u0117")} turi b\u016Bti ${adj} ${issue.minimum.toString()} ${sizing?.unit}`;
          }
          case "invalid_format": {
            const _issue = issue;
            if (_issue.format === "starts_with") {
              return `Eilut\u0117 privalo prasid\u0117ti "${_issue.prefix}"`;
            }
            if (_issue.format === "ends_with")
              return `Eilut\u0117 privalo pasibaigti "${_issue.suffix}"`;
            if (_issue.format === "includes")
              return `Eilut\u0117 privalo \u012Ftraukti "${_issue.includes}"`;
            if (_issue.format === "regex")
              return `Eilut\u0117 privalo atitikti ${_issue.pattern}`;
            return `Neteisingas ${FormatDictionary[_issue.format] ?? issue.format}`;
          }
          case "not_multiple_of":
            return `Skai\u010Dius privalo b\u016Bti ${issue.divisor} kartotinis.`;
          case "unrecognized_keys":
            return `Neatpa\u017Eint${issue.keys.length > 1 ? "i" : "as"} rakt${issue.keys.length > 1 ? "ai" : "as"}: ${util.joinValues(issue.keys, ", ")}`;
          case "invalid_key":
            return "Rastas klaidingas raktas";
          case "invalid_union":
            return "Klaidinga \u012Fvestis";
          case "invalid_element": {
            const origin = TypeDictionary[issue.origin] ?? issue.origin;
            return `${capitalizeFirstCharacter(origin ?? issue.origin ?? "reik\u0161m\u0117")} turi klaiding\u0105 \u012Fvest\u012F`;
          }
          default:
            return "Klaidinga \u012Fvestis";
        }
      };
    }, "error");
    function default_1() {
      return {
        localeError: error()
      };
    }
    __name(default_1, "default_1");
    module2.exports = exports2.default;
  }
});

// node_modules/zod/v4/locales/mk.cjs
var require_mk = __commonJS({
  "node_modules/zod/v4/locales/mk.cjs"(exports2, module2) {
    "use strict";
    var __createBinding = exports2 && exports2.__createBinding || (Object.create ? (function(o, m, k, k2) {
      if (k2 === void 0) k2 = k;
      var desc = Object.getOwnPropertyDescriptor(m, k);
      if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
        desc = { enumerable: true, get: /* @__PURE__ */ __name(function() {
          return m[k];
        }, "get") };
      }
      Object.defineProperty(o, k2, desc);
    }) : (function(o, m, k, k2) {
      if (k2 === void 0) k2 = k;
      o[k2] = m[k];
    }));
    var __setModuleDefault = exports2 && exports2.__setModuleDefault || (Object.create ? (function(o, v) {
      Object.defineProperty(o, "default", { enumerable: true, value: v });
    }) : function(o, v) {
      o["default"] = v;
    });
    var __importStar = exports2 && exports2.__importStar || function(mod) {
      if (mod && mod.__esModule) return mod;
      var result = {};
      if (mod != null) {
        for (var k in mod) if (k !== "default" && Object.prototype.hasOwnProperty.call(mod, k)) __createBinding(result, mod, k);
      }
      __setModuleDefault(result, mod);
      return result;
    };
    Object.defineProperty(exports2, "__esModule", { value: true });
    exports2.default = default_1;
    var util = __importStar(require_util());
    var error = /* @__PURE__ */ __name(() => {
      const Sizable = {
        string: { unit: "\u0437\u043D\u0430\u0446\u0438", verb: "\u0434\u0430 \u0438\u043C\u0430\u0430\u0442" },
        file: { unit: "\u0431\u0430\u0458\u0442\u0438", verb: "\u0434\u0430 \u0438\u043C\u0430\u0430\u0442" },
        array: { unit: "\u0441\u0442\u0430\u0432\u043A\u0438", verb: "\u0434\u0430 \u0438\u043C\u0430\u0430\u0442" },
        set: { unit: "\u0441\u0442\u0430\u0432\u043A\u0438", verb: "\u0434\u0430 \u0438\u043C\u0430\u0430\u0442" }
      };
      function getSizing(origin) {
        return Sizable[origin] ?? null;
      }
      __name(getSizing, "getSizing");
      const FormatDictionary = {
        regex: "\u0432\u043D\u0435\u0441",
        email: "\u0430\u0434\u0440\u0435\u0441\u0430 \u043D\u0430 \u0435-\u043F\u043E\u0448\u0442\u0430",
        url: "URL",
        emoji: "\u0435\u043C\u043E\u045F\u0438",
        uuid: "UUID",
        uuidv4: "UUIDv4",
        uuidv6: "UUIDv6",
        nanoid: "nanoid",
        guid: "GUID",
        cuid: "cuid",
        cuid2: "cuid2",
        ulid: "ULID",
        xid: "XID",
        ksuid: "KSUID",
        datetime: "ISO \u0434\u0430\u0442\u0443\u043C \u0438 \u0432\u0440\u0435\u043C\u0435",
        date: "ISO \u0434\u0430\u0442\u0443\u043C",
        time: "ISO \u0432\u0440\u0435\u043C\u0435",
        duration: "ISO \u0432\u0440\u0435\u043C\u0435\u0442\u0440\u0430\u0435\u045A\u0435",
        ipv4: "IPv4 \u0430\u0434\u0440\u0435\u0441\u0430",
        ipv6: "IPv6 \u0430\u0434\u0440\u0435\u0441\u0430",
        cidrv4: "IPv4 \u043E\u043F\u0441\u0435\u0433",
        cidrv6: "IPv6 \u043E\u043F\u0441\u0435\u0433",
        base64: "base64-\u0435\u043D\u043A\u043E\u0434\u0438\u0440\u0430\u043D\u0430 \u043D\u0438\u0437\u0430",
        base64url: "base64url-\u0435\u043D\u043A\u043E\u0434\u0438\u0440\u0430\u043D\u0430 \u043D\u0438\u0437\u0430",
        json_string: "JSON \u043D\u0438\u0437\u0430",
        e164: "E.164 \u0431\u0440\u043E\u0458",
        jwt: "JWT",
        template_literal: "\u0432\u043D\u0435\u0441"
      };
      const TypeDictionary = {
        nan: "NaN",
        number: "\u0431\u0440\u043E\u0458",
        array: "\u043D\u0438\u0437\u0430"
      };
      return (issue) => {
        switch (issue.code) {
          case "invalid_type": {
            const expected = TypeDictionary[issue.expected] ?? issue.expected;
            const receivedType = util.parsedType(issue.input);
            const received = TypeDictionary[receivedType] ?? receivedType;
            if (/^[A-Z]/.test(issue.expected)) {
              return `\u0413\u0440\u0435\u0448\u0435\u043D \u0432\u043D\u0435\u0441: \u0441\u0435 \u043E\u0447\u0435\u043A\u0443\u0432\u0430 instanceof ${issue.expected}, \u043F\u0440\u0438\u043C\u0435\u043D\u043E ${received}`;
            }
            return `\u0413\u0440\u0435\u0448\u0435\u043D \u0432\u043D\u0435\u0441: \u0441\u0435 \u043E\u0447\u0435\u043A\u0443\u0432\u0430 ${expected}, \u043F\u0440\u0438\u043C\u0435\u043D\u043E ${received}`;
          }
          case "invalid_value":
            if (issue.values.length === 1)
              return `Invalid input: expected ${util.stringifyPrimitive(issue.values[0])}`;
            return `\u0413\u0440\u0435\u0448\u0430\u043D\u0430 \u043E\u043F\u0446\u0438\u0458\u0430: \u0441\u0435 \u043E\u0447\u0435\u043A\u0443\u0432\u0430 \u0435\u0434\u043D\u0430 ${util.joinValues(issue.values, "|")}`;
          case "too_big": {
            const adj = issue.inclusive ? "<=" : "<";
            const sizing = getSizing(issue.origin);
            if (sizing)
              return `\u041F\u0440\u0435\u043C\u043D\u043E\u0433\u0443 \u0433\u043E\u043B\u0435\u043C: \u0441\u0435 \u043E\u0447\u0435\u043A\u0443\u0432\u0430 ${issue.origin ?? "\u0432\u0440\u0435\u0434\u043D\u043E\u0441\u0442\u0430"} \u0434\u0430 \u0438\u043C\u0430 ${adj}${issue.maximum.toString()} ${sizing.unit ?? "\u0435\u043B\u0435\u043C\u0435\u043D\u0442\u0438"}`;
            return `\u041F\u0440\u0435\u043C\u043D\u043E\u0433\u0443 \u0433\u043E\u043B\u0435\u043C: \u0441\u0435 \u043E\u0447\u0435\u043A\u0443\u0432\u0430 ${issue.origin ?? "\u0432\u0440\u0435\u0434\u043D\u043E\u0441\u0442\u0430"} \u0434\u0430 \u0431\u0438\u0434\u0435 ${adj}${issue.maximum.toString()}`;
          }
          case "too_small": {
            const adj = issue.inclusive ? ">=" : ">";
            const sizing = getSizing(issue.origin);
            if (sizing) {
              return `\u041F\u0440\u0435\u043C\u043D\u043E\u0433\u0443 \u043C\u0430\u043B: \u0441\u0435 \u043E\u0447\u0435\u043A\u0443\u0432\u0430 ${issue.origin} \u0434\u0430 \u0438\u043C\u0430 ${adj}${issue.minimum.toString()} ${sizing.unit}`;
            }
            return `\u041F\u0440\u0435\u043C\u043D\u043E\u0433\u0443 \u043C\u0430\u043B: \u0441\u0435 \u043E\u0447\u0435\u043A\u0443\u0432\u0430 ${issue.origin} \u0434\u0430 \u0431\u0438\u0434\u0435 ${adj}${issue.minimum.toString()}`;
          }
          case "invalid_format": {
            const _issue = issue;
            if (_issue.format === "starts_with") {
              return `\u041D\u0435\u0432\u0430\u0436\u0435\u0447\u043A\u0430 \u043D\u0438\u0437\u0430: \u043C\u043E\u0440\u0430 \u0434\u0430 \u0437\u0430\u043F\u043E\u0447\u043D\u0443\u0432\u0430 \u0441\u043E "${_issue.prefix}"`;
            }
            if (_issue.format === "ends_with")
              return `\u041D\u0435\u0432\u0430\u0436\u0435\u0447\u043A\u0430 \u043D\u0438\u0437\u0430: \u043C\u043E\u0440\u0430 \u0434\u0430 \u0437\u0430\u0432\u0440\u0448\u0443\u0432\u0430 \u0441\u043E "${_issue.suffix}"`;
            if (_issue.format === "includes")
              return `\u041D\u0435\u0432\u0430\u0436\u0435\u0447\u043A\u0430 \u043D\u0438\u0437\u0430: \u043C\u043E\u0440\u0430 \u0434\u0430 \u0432\u043A\u043B\u0443\u0447\u0443\u0432\u0430 "${_issue.includes}"`;
            if (_issue.format === "regex")
              return `\u041D\u0435\u0432\u0430\u0436\u0435\u0447\u043A\u0430 \u043D\u0438\u0437\u0430: \u043C\u043E\u0440\u0430 \u0434\u0430 \u043E\u0434\u0433\u043E\u0430\u0440\u0430 \u043D\u0430 \u043F\u0430\u0442\u0435\u0440\u043D\u043E\u0442 ${_issue.pattern}`;
            return `Invalid ${FormatDictionary[_issue.format] ?? issue.format}`;
          }
          case "not_multiple_of":
            return `\u0413\u0440\u0435\u0448\u0435\u043D \u0431\u0440\u043E\u0458: \u043C\u043E\u0440\u0430 \u0434\u0430 \u0431\u0438\u0434\u0435 \u0434\u0435\u043B\u0438\u0432 \u0441\u043E ${issue.divisor}`;
          case "unrecognized_keys":
            return `${issue.keys.length > 1 ? "\u041D\u0435\u043F\u0440\u0435\u043F\u043E\u0437\u043D\u0430\u0435\u043D\u0438 \u043A\u043B\u0443\u0447\u0435\u0432\u0438" : "\u041D\u0435\u043F\u0440\u0435\u043F\u043E\u0437\u043D\u0430\u0435\u043D \u043A\u043B\u0443\u0447"}: ${util.joinValues(issue.keys, ", ")}`;
          case "invalid_key":
            return `\u0413\u0440\u0435\u0448\u0435\u043D \u043A\u043B\u0443\u0447 \u0432\u043E ${issue.origin}`;
          case "invalid_union":
            return "\u0413\u0440\u0435\u0448\u0435\u043D \u0432\u043D\u0435\u0441";
          case "invalid_element":
            return `\u0413\u0440\u0435\u0448\u043D\u0430 \u0432\u0440\u0435\u0434\u043D\u043E\u0441\u0442 \u0432\u043E ${issue.origin}`;
          default:
            return `\u0413\u0440\u0435\u0448\u0435\u043D \u0432\u043D\u0435\u0441`;
        }
      };
    }, "error");
    function default_1() {
      return {
        localeError: error()
      };
    }
    __name(default_1, "default_1");
    module2.exports = exports2.default;
  }
});

// node_modules/zod/v4/locales/ms.cjs
var require_ms = __commonJS({
  "node_modules/zod/v4/locales/ms.cjs"(exports2, module2) {
    "use strict";
    var __createBinding = exports2 && exports2.__createBinding || (Object.create ? (function(o, m, k, k2) {
      if (k2 === void 0) k2 = k;
      var desc = Object.getOwnPropertyDescriptor(m, k);
      if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
        desc = { enumerable: true, get: /* @__PURE__ */ __name(function() {
          return m[k];
        }, "get") };
      }
      Object.defineProperty(o, k2, desc);
    }) : (function(o, m, k, k2) {
      if (k2 === void 0) k2 = k;
      o[k2] = m[k];
    }));
    var __setModuleDefault = exports2 && exports2.__setModuleDefault || (Object.create ? (function(o, v) {
      Object.defineProperty(o, "default", { enumerable: true, value: v });
    }) : function(o, v) {
      o["default"] = v;
    });
    var __importStar = exports2 && exports2.__importStar || function(mod) {
      if (mod && mod.__esModule) return mod;
      var result = {};
      if (mod != null) {
        for (var k in mod) if (k !== "default" && Object.prototype.hasOwnProperty.call(mod, k)) __createBinding(result, mod, k);
      }
      __setModuleDefault(result, mod);
      return result;
    };
    Object.defineProperty(exports2, "__esModule", { value: true });
    exports2.default = default_1;
    var util = __importStar(require_util());
    var error = /* @__PURE__ */ __name(() => {
      const Sizable = {
        string: { unit: "aksara", verb: "mempunyai" },
        file: { unit: "bait", verb: "mempunyai" },
        array: { unit: "elemen", verb: "mempunyai" },
        set: { unit: "elemen", verb: "mempunyai" }
      };
      function getSizing(origin) {
        return Sizable[origin] ?? null;
      }
      __name(getSizing, "getSizing");
      const FormatDictionary = {
        regex: "input",
        email: "alamat e-mel",
        url: "URL",
        emoji: "emoji",
        uuid: "UUID",
        uuidv4: "UUIDv4",
        uuidv6: "UUIDv6",
        nanoid: "nanoid",
        guid: "GUID",
        cuid: "cuid",
        cuid2: "cuid2",
        ulid: "ULID",
        xid: "XID",
        ksuid: "KSUID",
        datetime: "tarikh masa ISO",
        date: "tarikh ISO",
        time: "masa ISO",
        duration: "tempoh ISO",
        ipv4: "alamat IPv4",
        ipv6: "alamat IPv6",
        cidrv4: "julat IPv4",
        cidrv6: "julat IPv6",
        base64: "string dikodkan base64",
        base64url: "string dikodkan base64url",
        json_string: "string JSON",
        e164: "nombor E.164",
        jwt: "JWT",
        template_literal: "input"
      };
      const TypeDictionary = {
        nan: "NaN",
        number: "nombor"
      };
      return (issue) => {
        switch (issue.code) {
          case "invalid_type": {
            const expected = TypeDictionary[issue.expected] ?? issue.expected;
            const receivedType = util.parsedType(issue.input);
            const received = TypeDictionary[receivedType] ?? receivedType;
            if (/^[A-Z]/.test(issue.expected)) {
              return `Input tidak sah: dijangka instanceof ${issue.expected}, diterima ${received}`;
            }
            return `Input tidak sah: dijangka ${expected}, diterima ${received}`;
          }
          case "invalid_value":
            if (issue.values.length === 1)
              return `Input tidak sah: dijangka ${util.stringifyPrimitive(issue.values[0])}`;
            return `Pilihan tidak sah: dijangka salah satu daripada ${util.joinValues(issue.values, "|")}`;
          case "too_big": {
            const adj = issue.inclusive ? "<=" : "<";
            const sizing = getSizing(issue.origin);
            if (sizing)
              return `Terlalu besar: dijangka ${issue.origin ?? "nilai"} ${sizing.verb} ${adj}${issue.maximum.toString()} ${sizing.unit ?? "elemen"}`;
            return `Terlalu besar: dijangka ${issue.origin ?? "nilai"} adalah ${adj}${issue.maximum.toString()}`;
          }
          case "too_small": {
            const adj = issue.inclusive ? ">=" : ">";
            const sizing = getSizing(issue.origin);
            if (sizing) {
              return `Terlalu kecil: dijangka ${issue.origin} ${sizing.verb} ${adj}${issue.minimum.toString()} ${sizing.unit}`;
            }
            return `Terlalu kecil: dijangka ${issue.origin} adalah ${adj}${issue.minimum.toString()}`;
          }
          case "invalid_format": {
            const _issue = issue;
            if (_issue.format === "starts_with")
              return `String tidak sah: mesti bermula dengan "${_issue.prefix}"`;
            if (_issue.format === "ends_with")
              return `String tidak sah: mesti berakhir dengan "${_issue.suffix}"`;
            if (_issue.format === "includes")
              return `String tidak sah: mesti mengandungi "${_issue.includes}"`;
            if (_issue.format === "regex")
              return `String tidak sah: mesti sepadan dengan corak ${_issue.pattern}`;
            return `${FormatDictionary[_issue.format] ?? issue.format} tidak sah`;
          }
          case "not_multiple_of":
            return `Nombor tidak sah: perlu gandaan ${issue.divisor}`;
          case "unrecognized_keys":
            return `Kunci tidak dikenali: ${util.joinValues(issue.keys, ", ")}`;
          case "invalid_key":
            return `Kunci tidak sah dalam ${issue.origin}`;
          case "invalid_union":
            return "Input tidak sah";
          case "invalid_element":
            return `Nilai tidak sah dalam ${issue.origin}`;
          default:
            return `Input tidak sah`;
        }
      };
    }, "error");
    function default_1() {
      return {
        localeError: error()
      };
    }
    __name(default_1, "default_1");
    module2.exports = exports2.default;
  }
});

// node_modules/zod/v4/locales/nl.cjs
var require_nl = __commonJS({
  "node_modules/zod/v4/locales/nl.cjs"(exports2, module2) {
    "use strict";
    var __createBinding = exports2 && exports2.__createBinding || (Object.create ? (function(o, m, k, k2) {
      if (k2 === void 0) k2 = k;
      var desc = Object.getOwnPropertyDescriptor(m, k);
      if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
        desc = { enumerable: true, get: /* @__PURE__ */ __name(function() {
          return m[k];
        }, "get") };
      }
      Object.defineProperty(o, k2, desc);
    }) : (function(o, m, k, k2) {
      if (k2 === void 0) k2 = k;
      o[k2] = m[k];
    }));
    var __setModuleDefault = exports2 && exports2.__setModuleDefault || (Object.create ? (function(o, v) {
      Object.defineProperty(o, "default", { enumerable: true, value: v });
    }) : function(o, v) {
      o["default"] = v;
    });
    var __importStar = exports2 && exports2.__importStar || function(mod) {
      if (mod && mod.__esModule) return mod;
      var result = {};
      if (mod != null) {
        for (var k in mod) if (k !== "default" && Object.prototype.hasOwnProperty.call(mod, k)) __createBinding(result, mod, k);
      }
      __setModuleDefault(result, mod);
      return result;
    };
    Object.defineProperty(exports2, "__esModule", { value: true });
    exports2.default = default_1;
    var util = __importStar(require_util());
    var error = /* @__PURE__ */ __name(() => {
      const Sizable = {
        string: { unit: "tekens", verb: "heeft" },
        file: { unit: "bytes", verb: "heeft" },
        array: { unit: "elementen", verb: "heeft" },
        set: { unit: "elementen", verb: "heeft" }
      };
      function getSizing(origin) {
        return Sizable[origin] ?? null;
      }
      __name(getSizing, "getSizing");
      const FormatDictionary = {
        regex: "invoer",
        email: "emailadres",
        url: "URL",
        emoji: "emoji",
        uuid: "UUID",
        uuidv4: "UUIDv4",
        uuidv6: "UUIDv6",
        nanoid: "nanoid",
        guid: "GUID",
        cuid: "cuid",
        cuid2: "cuid2",
        ulid: "ULID",
        xid: "XID",
        ksuid: "KSUID",
        datetime: "ISO datum en tijd",
        date: "ISO datum",
        time: "ISO tijd",
        duration: "ISO duur",
        ipv4: "IPv4-adres",
        ipv6: "IPv6-adres",
        cidrv4: "IPv4-bereik",
        cidrv6: "IPv6-bereik",
        base64: "base64-gecodeerde tekst",
        base64url: "base64 URL-gecodeerde tekst",
        json_string: "JSON string",
        e164: "E.164-nummer",
        jwt: "JWT",
        template_literal: "invoer"
      };
      const TypeDictionary = {
        nan: "NaN",
        number: "getal"
      };
      return (issue) => {
        switch (issue.code) {
          case "invalid_type": {
            const expected = TypeDictionary[issue.expected] ?? issue.expected;
            const receivedType = util.parsedType(issue.input);
            const received = TypeDictionary[receivedType] ?? receivedType;
            if (/^[A-Z]/.test(issue.expected)) {
              return `Ongeldige invoer: verwacht instanceof ${issue.expected}, ontving ${received}`;
            }
            return `Ongeldige invoer: verwacht ${expected}, ontving ${received}`;
          }
          case "invalid_value":
            if (issue.values.length === 1)
              return `Ongeldige invoer: verwacht ${util.stringifyPrimitive(issue.values[0])}`;
            return `Ongeldige optie: verwacht \xE9\xE9n van ${util.joinValues(issue.values, "|")}`;
          case "too_big": {
            const adj = issue.inclusive ? "<=" : "<";
            const sizing = getSizing(issue.origin);
            const longName = issue.origin === "date" ? "laat" : issue.origin === "string" ? "lang" : "groot";
            if (sizing)
              return `Te ${longName}: verwacht dat ${issue.origin ?? "waarde"} ${adj}${issue.maximum.toString()} ${sizing.unit ?? "elementen"} ${sizing.verb}`;
            return `Te ${longName}: verwacht dat ${issue.origin ?? "waarde"} ${adj}${issue.maximum.toString()} is`;
          }
          case "too_small": {
            const adj = issue.inclusive ? ">=" : ">";
            const sizing = getSizing(issue.origin);
            const shortName = issue.origin === "date" ? "vroeg" : issue.origin === "string" ? "kort" : "klein";
            if (sizing) {
              return `Te ${shortName}: verwacht dat ${issue.origin} ${adj}${issue.minimum.toString()} ${sizing.unit} ${sizing.verb}`;
            }
            return `Te ${shortName}: verwacht dat ${issue.origin} ${adj}${issue.minimum.toString()} is`;
          }
          case "invalid_format": {
            const _issue = issue;
            if (_issue.format === "starts_with") {
              return `Ongeldige tekst: moet met "${_issue.prefix}" beginnen`;
            }
            if (_issue.format === "ends_with")
              return `Ongeldige tekst: moet op "${_issue.suffix}" eindigen`;
            if (_issue.format === "includes")
              return `Ongeldige tekst: moet "${_issue.includes}" bevatten`;
            if (_issue.format === "regex")
              return `Ongeldige tekst: moet overeenkomen met patroon ${_issue.pattern}`;
            return `Ongeldig: ${FormatDictionary[_issue.format] ?? issue.format}`;
          }
          case "not_multiple_of":
            return `Ongeldig getal: moet een veelvoud van ${issue.divisor} zijn`;
          case "unrecognized_keys":
            return `Onbekende key${issue.keys.length > 1 ? "s" : ""}: ${util.joinValues(issue.keys, ", ")}`;
          case "invalid_key":
            return `Ongeldige key in ${issue.origin}`;
          case "invalid_union":
            return "Ongeldige invoer";
          case "invalid_element":
            return `Ongeldige waarde in ${issue.origin}`;
          default:
            return `Ongeldige invoer`;
        }
      };
    }, "error");
    function default_1() {
      return {
        localeError: error()
      };
    }
    __name(default_1, "default_1");
    module2.exports = exports2.default;
  }
});

// node_modules/zod/v4/locales/no.cjs
var require_no = __commonJS({
  "node_modules/zod/v4/locales/no.cjs"(exports2, module2) {
    "use strict";
    var __createBinding = exports2 && exports2.__createBinding || (Object.create ? (function(o, m, k, k2) {
      if (k2 === void 0) k2 = k;
      var desc = Object.getOwnPropertyDescriptor(m, k);
      if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
        desc = { enumerable: true, get: /* @__PURE__ */ __name(function() {
          return m[k];
        }, "get") };
      }
      Object.defineProperty(o, k2, desc);
    }) : (function(o, m, k, k2) {
      if (k2 === void 0) k2 = k;
      o[k2] = m[k];
    }));
    var __setModuleDefault = exports2 && exports2.__setModuleDefault || (Object.create ? (function(o, v) {
      Object.defineProperty(o, "default", { enumerable: true, value: v });
    }) : function(o, v) {
      o["default"] = v;
    });
    var __importStar = exports2 && exports2.__importStar || function(mod) {
      if (mod && mod.__esModule) return mod;
      var result = {};
      if (mod != null) {
        for (var k in mod) if (k !== "default" && Object.prototype.hasOwnProperty.call(mod, k)) __createBinding(result, mod, k);
      }
      __setModuleDefault(result, mod);
      return result;
    };
    Object.defineProperty(exports2, "__esModule", { value: true });
    exports2.default = default_1;
    var util = __importStar(require_util());
    var error = /* @__PURE__ */ __name(() => {
      const Sizable = {
        string: { unit: "tegn", verb: "\xE5 ha" },
        file: { unit: "bytes", verb: "\xE5 ha" },
        array: { unit: "elementer", verb: "\xE5 inneholde" },
        set: { unit: "elementer", verb: "\xE5 inneholde" }
      };
      function getSizing(origin) {
        return Sizable[origin] ?? null;
      }
      __name(getSizing, "getSizing");
      const FormatDictionary = {
        regex: "input",
        email: "e-postadresse",
        url: "URL",
        emoji: "emoji",
        uuid: "UUID",
        uuidv4: "UUIDv4",
        uuidv6: "UUIDv6",
        nanoid: "nanoid",
        guid: "GUID",
        cuid: "cuid",
        cuid2: "cuid2",
        ulid: "ULID",
        xid: "XID",
        ksuid: "KSUID",
        datetime: "ISO dato- og klokkeslett",
        date: "ISO-dato",
        time: "ISO-klokkeslett",
        duration: "ISO-varighet",
        ipv4: "IPv4-omr\xE5de",
        ipv6: "IPv6-omr\xE5de",
        cidrv4: "IPv4-spekter",
        cidrv6: "IPv6-spekter",
        base64: "base64-enkodet streng",
        base64url: "base64url-enkodet streng",
        json_string: "JSON-streng",
        e164: "E.164-nummer",
        jwt: "JWT",
        template_literal: "input"
      };
      const TypeDictionary = {
        nan: "NaN",
        number: "tall",
        array: "liste"
      };
      return (issue) => {
        switch (issue.code) {
          case "invalid_type": {
            const expected = TypeDictionary[issue.expected] ?? issue.expected;
            const receivedType = util.parsedType(issue.input);
            const received = TypeDictionary[receivedType] ?? receivedType;
            if (/^[A-Z]/.test(issue.expected)) {
              return `Ugyldig input: forventet instanceof ${issue.expected}, fikk ${received}`;
            }
            return `Ugyldig input: forventet ${expected}, fikk ${received}`;
          }
          case "invalid_value":
            if (issue.values.length === 1)
              return `Ugyldig verdi: forventet ${util.stringifyPrimitive(issue.values[0])}`;
            return `Ugyldig valg: forventet en av ${util.joinValues(issue.values, "|")}`;
          case "too_big": {
            const adj = issue.inclusive ? "<=" : "<";
            const sizing = getSizing(issue.origin);
            if (sizing)
              return `For stor(t): forventet ${issue.origin ?? "value"} til \xE5 ha ${adj}${issue.maximum.toString()} ${sizing.unit ?? "elementer"}`;
            return `For stor(t): forventet ${issue.origin ?? "value"} til \xE5 ha ${adj}${issue.maximum.toString()}`;
          }
          case "too_small": {
            const adj = issue.inclusive ? ">=" : ">";
            const sizing = getSizing(issue.origin);
            if (sizing) {
              return `For lite(n): forventet ${issue.origin} til \xE5 ha ${adj}${issue.minimum.toString()} ${sizing.unit}`;
            }
            return `For lite(n): forventet ${issue.origin} til \xE5 ha ${adj}${issue.minimum.toString()}`;
          }
          case "invalid_format": {
            const _issue = issue;
            if (_issue.format === "starts_with")
              return `Ugyldig streng: m\xE5 starte med "${_issue.prefix}"`;
            if (_issue.format === "ends_with")
              return `Ugyldig streng: m\xE5 ende med "${_issue.suffix}"`;
            if (_issue.format === "includes")
              return `Ugyldig streng: m\xE5 inneholde "${_issue.includes}"`;
            if (_issue.format === "regex")
              return `Ugyldig streng: m\xE5 matche m\xF8nsteret ${_issue.pattern}`;
            return `Ugyldig ${FormatDictionary[_issue.format] ?? issue.format}`;
          }
          case "not_multiple_of":
            return `Ugyldig tall: m\xE5 v\xE6re et multiplum av ${issue.divisor}`;
          case "unrecognized_keys":
            return `${issue.keys.length > 1 ? "Ukjente n\xF8kler" : "Ukjent n\xF8kkel"}: ${util.joinValues(issue.keys, ", ")}`;
          case "invalid_key":
            return `Ugyldig n\xF8kkel i ${issue.origin}`;
          case "invalid_union":
            return "Ugyldig input";
          case "invalid_element":
            return `Ugyldig verdi i ${issue.origin}`;
          default:
            return `Ugyldig input`;
        }
      };
    }, "error");
    function default_1() {
      return {
        localeError: error()
      };
    }
    __name(default_1, "default_1");
    module2.exports = exports2.default;
  }
});

// node_modules/zod/v4/locales/ota.cjs
var require_ota = __commonJS({
  "node_modules/zod/v4/locales/ota.cjs"(exports2, module2) {
    "use strict";
    var __createBinding = exports2 && exports2.__createBinding || (Object.create ? (function(o, m, k, k2) {
      if (k2 === void 0) k2 = k;
      var desc = Object.getOwnPropertyDescriptor(m, k);
      if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
        desc = { enumerable: true, get: /* @__PURE__ */ __name(function() {
          return m[k];
        }, "get") };
      }
      Object.defineProperty(o, k2, desc);
    }) : (function(o, m, k, k2) {
      if (k2 === void 0) k2 = k;
      o[k2] = m[k];
    }));
    var __setModuleDefault = exports2 && exports2.__setModuleDefault || (Object.create ? (function(o, v) {
      Object.defineProperty(o, "default", { enumerable: true, value: v });
    }) : function(o, v) {
      o["default"] = v;
    });
    var __importStar = exports2 && exports2.__importStar || function(mod) {
      if (mod && mod.__esModule) return mod;
      var result = {};
      if (mod != null) {
        for (var k in mod) if (k !== "default" && Object.prototype.hasOwnProperty.call(mod, k)) __createBinding(result, mod, k);
      }
      __setModuleDefault(result, mod);
      return result;
    };
    Object.defineProperty(exports2, "__esModule", { value: true });
    exports2.default = default_1;
    var util = __importStar(require_util());
    var error = /* @__PURE__ */ __name(() => {
      const Sizable = {
        string: { unit: "harf", verb: "olmal\u0131d\u0131r" },
        file: { unit: "bayt", verb: "olmal\u0131d\u0131r" },
        array: { unit: "unsur", verb: "olmal\u0131d\u0131r" },
        set: { unit: "unsur", verb: "olmal\u0131d\u0131r" }
      };
      function getSizing(origin) {
        return Sizable[origin] ?? null;
      }
      __name(getSizing, "getSizing");
      const FormatDictionary = {
        regex: "giren",
        email: "epostag\xE2h",
        url: "URL",
        emoji: "emoji",
        uuid: "UUID",
        uuidv4: "UUIDv4",
        uuidv6: "UUIDv6",
        nanoid: "nanoid",
        guid: "GUID",
        cuid: "cuid",
        cuid2: "cuid2",
        ulid: "ULID",
        xid: "XID",
        ksuid: "KSUID",
        datetime: "ISO heng\xE2m\u0131",
        date: "ISO tarihi",
        time: "ISO zaman\u0131",
        duration: "ISO m\xFCddeti",
        ipv4: "IPv4 ni\u015F\xE2n\u0131",
        ipv6: "IPv6 ni\u015F\xE2n\u0131",
        cidrv4: "IPv4 menzili",
        cidrv6: "IPv6 menzili",
        base64: "base64-\u015Fifreli metin",
        base64url: "base64url-\u015Fifreli metin",
        json_string: "JSON metin",
        e164: "E.164 say\u0131s\u0131",
        jwt: "JWT",
        template_literal: "giren"
      };
      const TypeDictionary = {
        nan: "NaN",
        number: "numara",
        array: "saf",
        null: "gayb"
      };
      return (issue) => {
        switch (issue.code) {
          case "invalid_type": {
            const expected = TypeDictionary[issue.expected] ?? issue.expected;
            const receivedType = util.parsedType(issue.input);
            const received = TypeDictionary[receivedType] ?? receivedType;
            if (/^[A-Z]/.test(issue.expected)) {
              return `F\xE2sit giren: umulan instanceof ${issue.expected}, al\u0131nan ${received}`;
            }
            return `F\xE2sit giren: umulan ${expected}, al\u0131nan ${received}`;
          }
          case "invalid_value":
            if (issue.values.length === 1)
              return `F\xE2sit giren: umulan ${util.stringifyPrimitive(issue.values[0])}`;
            return `F\xE2sit tercih: m\xFBteberler ${util.joinValues(issue.values, "|")}`;
          case "too_big": {
            const adj = issue.inclusive ? "<=" : "<";
            const sizing = getSizing(issue.origin);
            if (sizing)
              return `Fazla b\xFCy\xFCk: ${issue.origin ?? "value"}, ${adj}${issue.maximum.toString()} ${sizing.unit ?? "elements"} sahip olmal\u0131yd\u0131.`;
            return `Fazla b\xFCy\xFCk: ${issue.origin ?? "value"}, ${adj}${issue.maximum.toString()} olmal\u0131yd\u0131.`;
          }
          case "too_small": {
            const adj = issue.inclusive ? ">=" : ">";
            const sizing = getSizing(issue.origin);
            if (sizing) {
              return `Fazla k\xFC\xE7\xFCk: ${issue.origin}, ${adj}${issue.minimum.toString()} ${sizing.unit} sahip olmal\u0131yd\u0131.`;
            }
            return `Fazla k\xFC\xE7\xFCk: ${issue.origin}, ${adj}${issue.minimum.toString()} olmal\u0131yd\u0131.`;
          }
          case "invalid_format": {
            const _issue = issue;
            if (_issue.format === "starts_with")
              return `F\xE2sit metin: "${_issue.prefix}" ile ba\u015Flamal\u0131.`;
            if (_issue.format === "ends_with")
              return `F\xE2sit metin: "${_issue.suffix}" ile bitmeli.`;
            if (_issue.format === "includes")
              return `F\xE2sit metin: "${_issue.includes}" ihtiv\xE2 etmeli.`;
            if (_issue.format === "regex")
              return `F\xE2sit metin: ${_issue.pattern} nak\u015F\u0131na uymal\u0131.`;
            return `F\xE2sit ${FormatDictionary[_issue.format] ?? issue.format}`;
          }
          case "not_multiple_of":
            return `F\xE2sit say\u0131: ${issue.divisor} kat\u0131 olmal\u0131yd\u0131.`;
          case "unrecognized_keys":
            return `Tan\u0131nmayan anahtar ${issue.keys.length > 1 ? "s" : ""}: ${util.joinValues(issue.keys, ", ")}`;
          case "invalid_key":
            return `${issue.origin} i\xE7in tan\u0131nmayan anahtar var.`;
          case "invalid_union":
            return "Giren tan\u0131namad\u0131.";
          case "invalid_element":
            return `${issue.origin} i\xE7in tan\u0131nmayan k\u0131ymet var.`;
          default:
            return `K\u0131ymet tan\u0131namad\u0131.`;
        }
      };
    }, "error");
    function default_1() {
      return {
        localeError: error()
      };
    }
    __name(default_1, "default_1");
    module2.exports = exports2.default;
  }
});

// node_modules/zod/v4/locales/ps.cjs
var require_ps = __commonJS({
  "node_modules/zod/v4/locales/ps.cjs"(exports2, module2) {
    "use strict";
    var __createBinding = exports2 && exports2.__createBinding || (Object.create ? (function(o, m, k, k2) {
      if (k2 === void 0) k2 = k;
      var desc = Object.getOwnPropertyDescriptor(m, k);
      if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
        desc = { enumerable: true, get: /* @__PURE__ */ __name(function() {
          return m[k];
        }, "get") };
      }
      Object.defineProperty(o, k2, desc);
    }) : (function(o, m, k, k2) {
      if (k2 === void 0) k2 = k;
      o[k2] = m[k];
    }));
    var __setModuleDefault = exports2 && exports2.__setModuleDefault || (Object.create ? (function(o, v) {
      Object.defineProperty(o, "default", { enumerable: true, value: v });
    }) : function(o, v) {
      o["default"] = v;
    });
    var __importStar = exports2 && exports2.__importStar || function(mod) {
      if (mod && mod.__esModule) return mod;
      var result = {};
      if (mod != null) {
        for (var k in mod) if (k !== "default" && Object.prototype.hasOwnProperty.call(mod, k)) __createBinding(result, mod, k);
      }
      __setModuleDefault(result, mod);
      return result;
    };
    Object.defineProperty(exports2, "__esModule", { value: true });
    exports2.default = default_1;
    var util = __importStar(require_util());
    var error = /* @__PURE__ */ __name(() => {
      const Sizable = {
        string: { unit: "\u062A\u0648\u06A9\u064A", verb: "\u0648\u0644\u0631\u064A" },
        file: { unit: "\u0628\u0627\u06CC\u067C\u0633", verb: "\u0648\u0644\u0631\u064A" },
        array: { unit: "\u062A\u0648\u06A9\u064A", verb: "\u0648\u0644\u0631\u064A" },
        set: { unit: "\u062A\u0648\u06A9\u064A", verb: "\u0648\u0644\u0631\u064A" }
      };
      function getSizing(origin) {
        return Sizable[origin] ?? null;
      }
      __name(getSizing, "getSizing");
      const FormatDictionary = {
        regex: "\u0648\u0631\u0648\u062F\u064A",
        email: "\u0628\u0631\u06CC\u069A\u0646\u0627\u0644\u06CC\u06A9",
        url: "\u06CC\u0648 \u0622\u0631 \u0627\u0644",
        emoji: "\u0627\u06CC\u0645\u0648\u062C\u064A",
        uuid: "UUID",
        uuidv4: "UUIDv4",
        uuidv6: "UUIDv6",
        nanoid: "nanoid",
        guid: "GUID",
        cuid: "cuid",
        cuid2: "cuid2",
        ulid: "ULID",
        xid: "XID",
        ksuid: "KSUID",
        datetime: "\u0646\u06CC\u067C\u0647 \u0627\u0648 \u0648\u062E\u062A",
        date: "\u0646\u06D0\u067C\u0647",
        time: "\u0648\u062E\u062A",
        duration: "\u0645\u0648\u062F\u0647",
        ipv4: "\u062F IPv4 \u067E\u062A\u0647",
        ipv6: "\u062F IPv6 \u067E\u062A\u0647",
        cidrv4: "\u062F IPv4 \u0633\u0627\u062D\u0647",
        cidrv6: "\u062F IPv6 \u0633\u0627\u062D\u0647",
        base64: "base64-encoded \u0645\u062A\u0646",
        base64url: "base64url-encoded \u0645\u062A\u0646",
        json_string: "JSON \u0645\u062A\u0646",
        e164: "\u062F E.164 \u0634\u0645\u06D0\u0631\u0647",
        jwt: "JWT",
        template_literal: "\u0648\u0631\u0648\u062F\u064A"
      };
      const TypeDictionary = {
        nan: "NaN",
        number: "\u0639\u062F\u062F",
        array: "\u0627\u0631\u06D0"
      };
      return (issue) => {
        switch (issue.code) {
          case "invalid_type": {
            const expected = TypeDictionary[issue.expected] ?? issue.expected;
            const receivedType = util.parsedType(issue.input);
            const received = TypeDictionary[receivedType] ?? receivedType;
            if (/^[A-Z]/.test(issue.expected)) {
              return `\u0646\u0627\u0633\u0645 \u0648\u0631\u0648\u062F\u064A: \u0628\u0627\u06CC\u062F instanceof ${issue.expected} \u0648\u0627\u06CC, \u0645\u06AB\u0631 ${received} \u062A\u0631\u0644\u0627\u0633\u0647 \u0634\u0648`;
            }
            return `\u0646\u0627\u0633\u0645 \u0648\u0631\u0648\u062F\u064A: \u0628\u0627\u06CC\u062F ${expected} \u0648\u0627\u06CC, \u0645\u06AB\u0631 ${received} \u062A\u0631\u0644\u0627\u0633\u0647 \u0634\u0648`;
          }
          case "invalid_value":
            if (issue.values.length === 1) {
              return `\u0646\u0627\u0633\u0645 \u0648\u0631\u0648\u062F\u064A: \u0628\u0627\u06CC\u062F ${util.stringifyPrimitive(issue.values[0])} \u0648\u0627\u06CC`;
            }
            return `\u0646\u0627\u0633\u0645 \u0627\u0646\u062A\u062E\u0627\u0628: \u0628\u0627\u06CC\u062F \u06CC\u0648 \u0644\u0647 ${util.joinValues(issue.values, "|")} \u0685\u062E\u0647 \u0648\u0627\u06CC`;
          case "too_big": {
            const adj = issue.inclusive ? "<=" : "<";
            const sizing = getSizing(issue.origin);
            if (sizing) {
              return `\u0689\u06CC\u0631 \u0644\u0648\u06CC: ${issue.origin ?? "\u0627\u0631\u0632\u069A\u062A"} \u0628\u0627\u06CC\u062F ${adj}${issue.maximum.toString()} ${sizing.unit ?? "\u0639\u0646\u0635\u0631\u0648\u0646\u0647"} \u0648\u0644\u0631\u064A`;
            }
            return `\u0689\u06CC\u0631 \u0644\u0648\u06CC: ${issue.origin ?? "\u0627\u0631\u0632\u069A\u062A"} \u0628\u0627\u06CC\u062F ${adj}${issue.maximum.toString()} \u0648\u064A`;
          }
          case "too_small": {
            const adj = issue.inclusive ? ">=" : ">";
            const sizing = getSizing(issue.origin);
            if (sizing) {
              return `\u0689\u06CC\u0631 \u06A9\u0648\u0686\u0646\u06CC: ${issue.origin} \u0628\u0627\u06CC\u062F ${adj}${issue.minimum.toString()} ${sizing.unit} \u0648\u0644\u0631\u064A`;
            }
            return `\u0689\u06CC\u0631 \u06A9\u0648\u0686\u0646\u06CC: ${issue.origin} \u0628\u0627\u06CC\u062F ${adj}${issue.minimum.toString()} \u0648\u064A`;
          }
          case "invalid_format": {
            const _issue = issue;
            if (_issue.format === "starts_with") {
              return `\u0646\u0627\u0633\u0645 \u0645\u062A\u0646: \u0628\u0627\u06CC\u062F \u062F "${_issue.prefix}" \u0633\u0631\u0647 \u067E\u06CC\u0644 \u0634\u064A`;
            }
            if (_issue.format === "ends_with") {
              return `\u0646\u0627\u0633\u0645 \u0645\u062A\u0646: \u0628\u0627\u06CC\u062F \u062F "${_issue.suffix}" \u0633\u0631\u0647 \u067E\u0627\u06CC \u062A\u0647 \u0648\u0631\u0633\u064A\u0696\u064A`;
            }
            if (_issue.format === "includes") {
              return `\u0646\u0627\u0633\u0645 \u0645\u062A\u0646: \u0628\u0627\u06CC\u062F "${_issue.includes}" \u0648\u0644\u0631\u064A`;
            }
            if (_issue.format === "regex") {
              return `\u0646\u0627\u0633\u0645 \u0645\u062A\u0646: \u0628\u0627\u06CC\u062F \u062F ${_issue.pattern} \u0633\u0631\u0647 \u0645\u0637\u0627\u0628\u0642\u062A \u0648\u0644\u0631\u064A`;
            }
            return `${FormatDictionary[_issue.format] ?? issue.format} \u0646\u0627\u0633\u0645 \u062F\u06CC`;
          }
          case "not_multiple_of":
            return `\u0646\u0627\u0633\u0645 \u0639\u062F\u062F: \u0628\u0627\u06CC\u062F \u062F ${issue.divisor} \u0645\u0636\u0631\u0628 \u0648\u064A`;
          case "unrecognized_keys":
            return `\u0646\u0627\u0633\u0645 ${issue.keys.length > 1 ? "\u06A9\u0644\u06CC\u0689\u0648\u0646\u0647" : "\u06A9\u0644\u06CC\u0689"}: ${util.joinValues(issue.keys, ", ")}`;
          case "invalid_key":
            return `\u0646\u0627\u0633\u0645 \u06A9\u0644\u06CC\u0689 \u067E\u0647 ${issue.origin} \u06A9\u06D0`;
          case "invalid_union":
            return `\u0646\u0627\u0633\u0645\u0647 \u0648\u0631\u0648\u062F\u064A`;
          case "invalid_element":
            return `\u0646\u0627\u0633\u0645 \u0639\u0646\u0635\u0631 \u067E\u0647 ${issue.origin} \u06A9\u06D0`;
          default:
            return `\u0646\u0627\u0633\u0645\u0647 \u0648\u0631\u0648\u062F\u064A`;
        }
      };
    }, "error");
    function default_1() {
      return {
        localeError: error()
      };
    }
    __name(default_1, "default_1");
    module2.exports = exports2.default;
  }
});

// node_modules/zod/v4/locales/pl.cjs
var require_pl = __commonJS({
  "node_modules/zod/v4/locales/pl.cjs"(exports2, module2) {
    "use strict";
    var __createBinding = exports2 && exports2.__createBinding || (Object.create ? (function(o, m, k, k2) {
      if (k2 === void 0) k2 = k;
      var desc = Object.getOwnPropertyDescriptor(m, k);
      if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
        desc = { enumerable: true, get: /* @__PURE__ */ __name(function() {
          return m[k];
        }, "get") };
      }
      Object.defineProperty(o, k2, desc);
    }) : (function(o, m, k, k2) {
      if (k2 === void 0) k2 = k;
      o[k2] = m[k];
    }));
    var __setModuleDefault = exports2 && exports2.__setModuleDefault || (Object.create ? (function(o, v) {
      Object.defineProperty(o, "default", { enumerable: true, value: v });
    }) : function(o, v) {
      o["default"] = v;
    });
    var __importStar = exports2 && exports2.__importStar || function(mod) {
      if (mod && mod.__esModule) return mod;
      var result = {};
      if (mod != null) {
        for (var k in mod) if (k !== "default" && Object.prototype.hasOwnProperty.call(mod, k)) __createBinding(result, mod, k);
      }
      __setModuleDefault(result, mod);
      return result;
    };
    Object.defineProperty(exports2, "__esModule", { value: true });
    exports2.default = default_1;
    var util = __importStar(require_util());
    var error = /* @__PURE__ */ __name(() => {
      const Sizable = {
        string: { unit: "znak\xF3w", verb: "mie\u0107" },
        file: { unit: "bajt\xF3w", verb: "mie\u0107" },
        array: { unit: "element\xF3w", verb: "mie\u0107" },
        set: { unit: "element\xF3w", verb: "mie\u0107" }
      };
      function getSizing(origin) {
        return Sizable[origin] ?? null;
      }
      __name(getSizing, "getSizing");
      const FormatDictionary = {
        regex: "wyra\u017Cenie",
        email: "adres email",
        url: "URL",
        emoji: "emoji",
        uuid: "UUID",
        uuidv4: "UUIDv4",
        uuidv6: "UUIDv6",
        nanoid: "nanoid",
        guid: "GUID",
        cuid: "cuid",
        cuid2: "cuid2",
        ulid: "ULID",
        xid: "XID",
        ksuid: "KSUID",
        datetime: "data i godzina w formacie ISO",
        date: "data w formacie ISO",
        time: "godzina w formacie ISO",
        duration: "czas trwania ISO",
        ipv4: "adres IPv4",
        ipv6: "adres IPv6",
        cidrv4: "zakres IPv4",
        cidrv6: "zakres IPv6",
        base64: "ci\u0105g znak\xF3w zakodowany w formacie base64",
        base64url: "ci\u0105g znak\xF3w zakodowany w formacie base64url",
        json_string: "ci\u0105g znak\xF3w w formacie JSON",
        e164: "liczba E.164",
        jwt: "JWT",
        template_literal: "wej\u015Bcie"
      };
      const TypeDictionary = {
        nan: "NaN",
        number: "liczba",
        array: "tablica"
      };
      return (issue) => {
        switch (issue.code) {
          case "invalid_type": {
            const expected = TypeDictionary[issue.expected] ?? issue.expected;
            const receivedType = util.parsedType(issue.input);
            const received = TypeDictionary[receivedType] ?? receivedType;
            if (/^[A-Z]/.test(issue.expected)) {
              return `Nieprawid\u0142owe dane wej\u015Bciowe: oczekiwano instanceof ${issue.expected}, otrzymano ${received}`;
            }
            return `Nieprawid\u0142owe dane wej\u015Bciowe: oczekiwano ${expected}, otrzymano ${received}`;
          }
          case "invalid_value":
            if (issue.values.length === 1)
              return `Nieprawid\u0142owe dane wej\u015Bciowe: oczekiwano ${util.stringifyPrimitive(issue.values[0])}`;
            return `Nieprawid\u0142owa opcja: oczekiwano jednej z warto\u015Bci ${util.joinValues(issue.values, "|")}`;
          case "too_big": {
            const adj = issue.inclusive ? "<=" : "<";
            const sizing = getSizing(issue.origin);
            if (sizing) {
              return `Za du\u017Ca warto\u015B\u0107: oczekiwano, \u017Ce ${issue.origin ?? "warto\u015B\u0107"} b\u0119dzie mie\u0107 ${adj}${issue.maximum.toString()} ${sizing.unit ?? "element\xF3w"}`;
            }
            return `Zbyt du\u017C(y/a/e): oczekiwano, \u017Ce ${issue.origin ?? "warto\u015B\u0107"} b\u0119dzie wynosi\u0107 ${adj}${issue.maximum.toString()}`;
          }
          case "too_small": {
            const adj = issue.inclusive ? ">=" : ">";
            const sizing = getSizing(issue.origin);
            if (sizing) {
              return `Za ma\u0142a warto\u015B\u0107: oczekiwano, \u017Ce ${issue.origin ?? "warto\u015B\u0107"} b\u0119dzie mie\u0107 ${adj}${issue.minimum.toString()} ${sizing.unit ?? "element\xF3w"}`;
            }
            return `Zbyt ma\u0142(y/a/e): oczekiwano, \u017Ce ${issue.origin ?? "warto\u015B\u0107"} b\u0119dzie wynosi\u0107 ${adj}${issue.minimum.toString()}`;
          }
          case "invalid_format": {
            const _issue = issue;
            if (_issue.format === "starts_with")
              return `Nieprawid\u0142owy ci\u0105g znak\xF3w: musi zaczyna\u0107 si\u0119 od "${_issue.prefix}"`;
            if (_issue.format === "ends_with")
              return `Nieprawid\u0142owy ci\u0105g znak\xF3w: musi ko\u0144czy\u0107 si\u0119 na "${_issue.suffix}"`;
            if (_issue.format === "includes")
              return `Nieprawid\u0142owy ci\u0105g znak\xF3w: musi zawiera\u0107 "${_issue.includes}"`;
            if (_issue.format === "regex")
              return `Nieprawid\u0142owy ci\u0105g znak\xF3w: musi odpowiada\u0107 wzorcowi ${_issue.pattern}`;
            return `Nieprawid\u0142ow(y/a/e) ${FormatDictionary[_issue.format] ?? issue.format}`;
          }
          case "not_multiple_of":
            return `Nieprawid\u0142owa liczba: musi by\u0107 wielokrotno\u015Bci\u0105 ${issue.divisor}`;
          case "unrecognized_keys":
            return `Nierozpoznane klucze${issue.keys.length > 1 ? "s" : ""}: ${util.joinValues(issue.keys, ", ")}`;
          case "invalid_key":
            return `Nieprawid\u0142owy klucz w ${issue.origin}`;
          case "invalid_union":
            return "Nieprawid\u0142owe dane wej\u015Bciowe";
          case "invalid_element":
            return `Nieprawid\u0142owa warto\u015B\u0107 w ${issue.origin}`;
          default:
            return `Nieprawid\u0142owe dane wej\u015Bciowe`;
        }
      };
    }, "error");
    function default_1() {
      return {
        localeError: error()
      };
    }
    __name(default_1, "default_1");
    module2.exports = exports2.default;
  }
});

// node_modules/zod/v4/locales/pt.cjs
var require_pt = __commonJS({
  "node_modules/zod/v4/locales/pt.cjs"(exports2, module2) {
    "use strict";
    var __createBinding = exports2 && exports2.__createBinding || (Object.create ? (function(o, m, k, k2) {
      if (k2 === void 0) k2 = k;
      var desc = Object.getOwnPropertyDescriptor(m, k);
      if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
        desc = { enumerable: true, get: /* @__PURE__ */ __name(function() {
          return m[k];
        }, "get") };
      }
      Object.defineProperty(o, k2, desc);
    }) : (function(o, m, k, k2) {
      if (k2 === void 0) k2 = k;
      o[k2] = m[k];
    }));
    var __setModuleDefault = exports2 && exports2.__setModuleDefault || (Object.create ? (function(o, v) {
      Object.defineProperty(o, "default", { enumerable: true, value: v });
    }) : function(o, v) {
      o["default"] = v;
    });
    var __importStar = exports2 && exports2.__importStar || function(mod) {
      if (mod && mod.__esModule) return mod;
      var result = {};
      if (mod != null) {
        for (var k in mod) if (k !== "default" && Object.prototype.hasOwnProperty.call(mod, k)) __createBinding(result, mod, k);
      }
      __setModuleDefault(result, mod);
      return result;
    };
    Object.defineProperty(exports2, "__esModule", { value: true });
    exports2.default = default_1;
    var util = __importStar(require_util());
    var error = /* @__PURE__ */ __name(() => {
      const Sizable = {
        string: { unit: "caracteres", verb: "ter" },
        file: { unit: "bytes", verb: "ter" },
        array: { unit: "itens", verb: "ter" },
        set: { unit: "itens", verb: "ter" }
      };
      function getSizing(origin) {
        return Sizable[origin] ?? null;
      }
      __name(getSizing, "getSizing");
      const FormatDictionary = {
        regex: "padr\xE3o",
        email: "endere\xE7o de e-mail",
        url: "URL",
        emoji: "emoji",
        uuid: "UUID",
        uuidv4: "UUIDv4",
        uuidv6: "UUIDv6",
        nanoid: "nanoid",
        guid: "GUID",
        cuid: "cuid",
        cuid2: "cuid2",
        ulid: "ULID",
        xid: "XID",
        ksuid: "KSUID",
        datetime: "data e hora ISO",
        date: "data ISO",
        time: "hora ISO",
        duration: "dura\xE7\xE3o ISO",
        ipv4: "endere\xE7o IPv4",
        ipv6: "endere\xE7o IPv6",
        cidrv4: "faixa de IPv4",
        cidrv6: "faixa de IPv6",
        base64: "texto codificado em base64",
        base64url: "URL codificada em base64",
        json_string: "texto JSON",
        e164: "n\xFAmero E.164",
        jwt: "JWT",
        template_literal: "entrada"
      };
      const TypeDictionary = {
        nan: "NaN",
        number: "n\xFAmero",
        null: "nulo"
      };
      return (issue) => {
        switch (issue.code) {
          case "invalid_type": {
            const expected = TypeDictionary[issue.expected] ?? issue.expected;
            const receivedType = util.parsedType(issue.input);
            const received = TypeDictionary[receivedType] ?? receivedType;
            if (/^[A-Z]/.test(issue.expected)) {
              return `Tipo inv\xE1lido: esperado instanceof ${issue.expected}, recebido ${received}`;
            }
            return `Tipo inv\xE1lido: esperado ${expected}, recebido ${received}`;
          }
          case "invalid_value":
            if (issue.values.length === 1)
              return `Entrada inv\xE1lida: esperado ${util.stringifyPrimitive(issue.values[0])}`;
            return `Op\xE7\xE3o inv\xE1lida: esperada uma das ${util.joinValues(issue.values, "|")}`;
          case "too_big": {
            const adj = issue.inclusive ? "<=" : "<";
            const sizing = getSizing(issue.origin);
            if (sizing)
              return `Muito grande: esperado que ${issue.origin ?? "valor"} tivesse ${adj}${issue.maximum.toString()} ${sizing.unit ?? "elementos"}`;
            return `Muito grande: esperado que ${issue.origin ?? "valor"} fosse ${adj}${issue.maximum.toString()}`;
          }
          case "too_small": {
            const adj = issue.inclusive ? ">=" : ">";
            const sizing = getSizing(issue.origin);
            if (sizing) {
              return `Muito pequeno: esperado que ${issue.origin} tivesse ${adj}${issue.minimum.toString()} ${sizing.unit}`;
            }
            return `Muito pequeno: esperado que ${issue.origin} fosse ${adj}${issue.minimum.toString()}`;
          }
          case "invalid_format": {
            const _issue = issue;
            if (_issue.format === "starts_with")
              return `Texto inv\xE1lido: deve come\xE7ar com "${_issue.prefix}"`;
            if (_issue.format === "ends_with")
              return `Texto inv\xE1lido: deve terminar com "${_issue.suffix}"`;
            if (_issue.format === "includes")
              return `Texto inv\xE1lido: deve incluir "${_issue.includes}"`;
            if (_issue.format === "regex")
              return `Texto inv\xE1lido: deve corresponder ao padr\xE3o ${_issue.pattern}`;
            return `${FormatDictionary[_issue.format] ?? issue.format} inv\xE1lido`;
          }
          case "not_multiple_of":
            return `N\xFAmero inv\xE1lido: deve ser m\xFAltiplo de ${issue.divisor}`;
          case "unrecognized_keys":
            return `Chave${issue.keys.length > 1 ? "s" : ""} desconhecida${issue.keys.length > 1 ? "s" : ""}: ${util.joinValues(issue.keys, ", ")}`;
          case "invalid_key":
            return `Chave inv\xE1lida em ${issue.origin}`;
          case "invalid_union":
            return "Entrada inv\xE1lida";
          case "invalid_element":
            return `Valor inv\xE1lido em ${issue.origin}`;
          default:
            return `Campo inv\xE1lido`;
        }
      };
    }, "error");
    function default_1() {
      return {
        localeError: error()
      };
    }
    __name(default_1, "default_1");
    module2.exports = exports2.default;
  }
});

// node_modules/zod/v4/locales/ru.cjs
var require_ru = __commonJS({
  "node_modules/zod/v4/locales/ru.cjs"(exports2, module2) {
    "use strict";
    var __createBinding = exports2 && exports2.__createBinding || (Object.create ? (function(o, m, k, k2) {
      if (k2 === void 0) k2 = k;
      var desc = Object.getOwnPropertyDescriptor(m, k);
      if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
        desc = { enumerable: true, get: /* @__PURE__ */ __name(function() {
          return m[k];
        }, "get") };
      }
      Object.defineProperty(o, k2, desc);
    }) : (function(o, m, k, k2) {
      if (k2 === void 0) k2 = k;
      o[k2] = m[k];
    }));
    var __setModuleDefault = exports2 && exports2.__setModuleDefault || (Object.create ? (function(o, v) {
      Object.defineProperty(o, "default", { enumerable: true, value: v });
    }) : function(o, v) {
      o["default"] = v;
    });
    var __importStar = exports2 && exports2.__importStar || function(mod) {
      if (mod && mod.__esModule) return mod;
      var result = {};
      if (mod != null) {
        for (var k in mod) if (k !== "default" && Object.prototype.hasOwnProperty.call(mod, k)) __createBinding(result, mod, k);
      }
      __setModuleDefault(result, mod);
      return result;
    };
    Object.defineProperty(exports2, "__esModule", { value: true });
    exports2.default = default_1;
    var util = __importStar(require_util());
    function getRussianPlural(count, one, few, many) {
      const absCount = Math.abs(count);
      const lastDigit = absCount % 10;
      const lastTwoDigits = absCount % 100;
      if (lastTwoDigits >= 11 && lastTwoDigits <= 19) {
        return many;
      }
      if (lastDigit === 1) {
        return one;
      }
      if (lastDigit >= 2 && lastDigit <= 4) {
        return few;
      }
      return many;
    }
    __name(getRussianPlural, "getRussianPlural");
    var error = /* @__PURE__ */ __name(() => {
      const Sizable = {
        string: {
          unit: {
            one: "\u0441\u0438\u043C\u0432\u043E\u043B",
            few: "\u0441\u0438\u043C\u0432\u043E\u043B\u0430",
            many: "\u0441\u0438\u043C\u0432\u043E\u043B\u043E\u0432"
          },
          verb: "\u0438\u043C\u0435\u0442\u044C"
        },
        file: {
          unit: {
            one: "\u0431\u0430\u0439\u0442",
            few: "\u0431\u0430\u0439\u0442\u0430",
            many: "\u0431\u0430\u0439\u0442"
          },
          verb: "\u0438\u043C\u0435\u0442\u044C"
        },
        array: {
          unit: {
            one: "\u044D\u043B\u0435\u043C\u0435\u043D\u0442",
            few: "\u044D\u043B\u0435\u043C\u0435\u043D\u0442\u0430",
            many: "\u044D\u043B\u0435\u043C\u0435\u043D\u0442\u043E\u0432"
          },
          verb: "\u0438\u043C\u0435\u0442\u044C"
        },
        set: {
          unit: {
            one: "\u044D\u043B\u0435\u043C\u0435\u043D\u0442",
            few: "\u044D\u043B\u0435\u043C\u0435\u043D\u0442\u0430",
            many: "\u044D\u043B\u0435\u043C\u0435\u043D\u0442\u043E\u0432"
          },
          verb: "\u0438\u043C\u0435\u0442\u044C"
        }
      };
      function getSizing(origin) {
        return Sizable[origin] ?? null;
      }
      __name(getSizing, "getSizing");
      const FormatDictionary = {
        regex: "\u0432\u0432\u043E\u0434",
        email: "email \u0430\u0434\u0440\u0435\u0441",
        url: "URL",
        emoji: "\u044D\u043C\u043E\u0434\u0437\u0438",
        uuid: "UUID",
        uuidv4: "UUIDv4",
        uuidv6: "UUIDv6",
        nanoid: "nanoid",
        guid: "GUID",
        cuid: "cuid",
        cuid2: "cuid2",
        ulid: "ULID",
        xid: "XID",
        ksuid: "KSUID",
        datetime: "ISO \u0434\u0430\u0442\u0430 \u0438 \u0432\u0440\u0435\u043C\u044F",
        date: "ISO \u0434\u0430\u0442\u0430",
        time: "ISO \u0432\u0440\u0435\u043C\u044F",
        duration: "ISO \u0434\u043B\u0438\u0442\u0435\u043B\u044C\u043D\u043E\u0441\u0442\u044C",
        ipv4: "IPv4 \u0430\u0434\u0440\u0435\u0441",
        ipv6: "IPv6 \u0430\u0434\u0440\u0435\u0441",
        cidrv4: "IPv4 \u0434\u0438\u0430\u043F\u0430\u0437\u043E\u043D",
        cidrv6: "IPv6 \u0434\u0438\u0430\u043F\u0430\u0437\u043E\u043D",
        base64: "\u0441\u0442\u0440\u043E\u043A\u0430 \u0432 \u0444\u043E\u0440\u043C\u0430\u0442\u0435 base64",
        base64url: "\u0441\u0442\u0440\u043E\u043A\u0430 \u0432 \u0444\u043E\u0440\u043C\u0430\u0442\u0435 base64url",
        json_string: "JSON \u0441\u0442\u0440\u043E\u043A\u0430",
        e164: "\u043D\u043E\u043C\u0435\u0440 E.164",
        jwt: "JWT",
        template_literal: "\u0432\u0432\u043E\u0434"
      };
      const TypeDictionary = {
        nan: "NaN",
        number: "\u0447\u0438\u0441\u043B\u043E",
        array: "\u043C\u0430\u0441\u0441\u0438\u0432"
      };
      return (issue) => {
        switch (issue.code) {
          case "invalid_type": {
            const expected = TypeDictionary[issue.expected] ?? issue.expected;
            const receivedType = util.parsedType(issue.input);
            const received = TypeDictionary[receivedType] ?? receivedType;
            if (/^[A-Z]/.test(issue.expected)) {
              return `\u041D\u0435\u0432\u0435\u0440\u043D\u044B\u0439 \u0432\u0432\u043E\u0434: \u043E\u0436\u0438\u0434\u0430\u043B\u043E\u0441\u044C instanceof ${issue.expected}, \u043F\u043E\u043B\u0443\u0447\u0435\u043D\u043E ${received}`;
            }
            return `\u041D\u0435\u0432\u0435\u0440\u043D\u044B\u0439 \u0432\u0432\u043E\u0434: \u043E\u0436\u0438\u0434\u0430\u043B\u043E\u0441\u044C ${expected}, \u043F\u043E\u043B\u0443\u0447\u0435\u043D\u043E ${received}`;
          }
          case "invalid_value":
            if (issue.values.length === 1)
              return `\u041D\u0435\u0432\u0435\u0440\u043D\u044B\u0439 \u0432\u0432\u043E\u0434: \u043E\u0436\u0438\u0434\u0430\u043B\u043E\u0441\u044C ${util.stringifyPrimitive(issue.values[0])}`;
            return `\u041D\u0435\u0432\u0435\u0440\u043D\u044B\u0439 \u0432\u0430\u0440\u0438\u0430\u043D\u0442: \u043E\u0436\u0438\u0434\u0430\u043B\u043E\u0441\u044C \u043E\u0434\u043D\u043E \u0438\u0437 ${util.joinValues(issue.values, "|")}`;
          case "too_big": {
            const adj = issue.inclusive ? "<=" : "<";
            const sizing = getSizing(issue.origin);
            if (sizing) {
              const maxValue = Number(issue.maximum);
              const unit = getRussianPlural(maxValue, sizing.unit.one, sizing.unit.few, sizing.unit.many);
              return `\u0421\u043B\u0438\u0448\u043A\u043E\u043C \u0431\u043E\u043B\u044C\u0448\u043E\u0435 \u0437\u043D\u0430\u0447\u0435\u043D\u0438\u0435: \u043E\u0436\u0438\u0434\u0430\u043B\u043E\u0441\u044C, \u0447\u0442\u043E ${issue.origin ?? "\u0437\u043D\u0430\u0447\u0435\u043D\u0438\u0435"} \u0431\u0443\u0434\u0435\u0442 \u0438\u043C\u0435\u0442\u044C ${adj}${issue.maximum.toString()} ${unit}`;
            }
            return `\u0421\u043B\u0438\u0448\u043A\u043E\u043C \u0431\u043E\u043B\u044C\u0448\u043E\u0435 \u0437\u043D\u0430\u0447\u0435\u043D\u0438\u0435: \u043E\u0436\u0438\u0434\u0430\u043B\u043E\u0441\u044C, \u0447\u0442\u043E ${issue.origin ?? "\u0437\u043D\u0430\u0447\u0435\u043D\u0438\u0435"} \u0431\u0443\u0434\u0435\u0442 ${adj}${issue.maximum.toString()}`;
          }
          case "too_small": {
            const adj = issue.inclusive ? ">=" : ">";
            const sizing = getSizing(issue.origin);
            if (sizing) {
              const minValue = Number(issue.minimum);
              const unit = getRussianPlural(minValue, sizing.unit.one, sizing.unit.few, sizing.unit.many);
              return `\u0421\u043B\u0438\u0448\u043A\u043E\u043C \u043C\u0430\u043B\u0435\u043D\u044C\u043A\u043E\u0435 \u0437\u043D\u0430\u0447\u0435\u043D\u0438\u0435: \u043E\u0436\u0438\u0434\u0430\u043B\u043E\u0441\u044C, \u0447\u0442\u043E ${issue.origin} \u0431\u0443\u0434\u0435\u0442 \u0438\u043C\u0435\u0442\u044C ${adj}${issue.minimum.toString()} ${unit}`;
            }
            return `\u0421\u043B\u0438\u0448\u043A\u043E\u043C \u043C\u0430\u043B\u0435\u043D\u044C\u043A\u043E\u0435 \u0437\u043D\u0430\u0447\u0435\u043D\u0438\u0435: \u043E\u0436\u0438\u0434\u0430\u043B\u043E\u0441\u044C, \u0447\u0442\u043E ${issue.origin} \u0431\u0443\u0434\u0435\u0442 ${adj}${issue.minimum.toString()}`;
          }
          case "invalid_format": {
            const _issue = issue;
            if (_issue.format === "starts_with")
              return `\u041D\u0435\u0432\u0435\u0440\u043D\u0430\u044F \u0441\u0442\u0440\u043E\u043A\u0430: \u0434\u043E\u043B\u0436\u043D\u0430 \u043D\u0430\u0447\u0438\u043D\u0430\u0442\u044C\u0441\u044F \u0441 "${_issue.prefix}"`;
            if (_issue.format === "ends_with")
              return `\u041D\u0435\u0432\u0435\u0440\u043D\u0430\u044F \u0441\u0442\u0440\u043E\u043A\u0430: \u0434\u043E\u043B\u0436\u043D\u0430 \u0437\u0430\u043A\u0430\u043D\u0447\u0438\u0432\u0430\u0442\u044C\u0441\u044F \u043D\u0430 "${_issue.suffix}"`;
            if (_issue.format === "includes")
              return `\u041D\u0435\u0432\u0435\u0440\u043D\u0430\u044F \u0441\u0442\u0440\u043E\u043A\u0430: \u0434\u043E\u043B\u0436\u043D\u0430 \u0441\u043E\u0434\u0435\u0440\u0436\u0430\u0442\u044C "${_issue.includes}"`;
            if (_issue.format === "regex")
              return `\u041D\u0435\u0432\u0435\u0440\u043D\u0430\u044F \u0441\u0442\u0440\u043E\u043A\u0430: \u0434\u043E\u043B\u0436\u043D\u0430 \u0441\u043E\u043E\u0442\u0432\u0435\u0442\u0441\u0442\u0432\u043E\u0432\u0430\u0442\u044C \u0448\u0430\u0431\u043B\u043E\u043D\u0443 ${_issue.pattern}`;
            return `\u041D\u0435\u0432\u0435\u0440\u043D\u044B\u0439 ${FormatDictionary[_issue.format] ?? issue.format}`;
          }
          case "not_multiple_of":
            return `\u041D\u0435\u0432\u0435\u0440\u043D\u043E\u0435 \u0447\u0438\u0441\u043B\u043E: \u0434\u043E\u043B\u0436\u043D\u043E \u0431\u044B\u0442\u044C \u043A\u0440\u0430\u0442\u043D\u044B\u043C ${issue.divisor}`;
          case "unrecognized_keys":
            return `\u041D\u0435\u0440\u0430\u0441\u043F\u043E\u0437\u043D\u0430\u043D\u043D${issue.keys.length > 1 ? "\u044B\u0435" : "\u044B\u0439"} \u043A\u043B\u044E\u0447${issue.keys.length > 1 ? "\u0438" : ""}: ${util.joinValues(issue.keys, ", ")}`;
          case "invalid_key":
            return `\u041D\u0435\u0432\u0435\u0440\u043D\u044B\u0439 \u043A\u043B\u044E\u0447 \u0432 ${issue.origin}`;
          case "invalid_union":
            return "\u041D\u0435\u0432\u0435\u0440\u043D\u044B\u0435 \u0432\u0445\u043E\u0434\u043D\u044B\u0435 \u0434\u0430\u043D\u043D\u044B\u0435";
          case "invalid_element":
            return `\u041D\u0435\u0432\u0435\u0440\u043D\u043E\u0435 \u0437\u043D\u0430\u0447\u0435\u043D\u0438\u0435 \u0432 ${issue.origin}`;
          default:
            return `\u041D\u0435\u0432\u0435\u0440\u043D\u044B\u0435 \u0432\u0445\u043E\u0434\u043D\u044B\u0435 \u0434\u0430\u043D\u043D\u044B\u0435`;
        }
      };
    }, "error");
    function default_1() {
      return {
        localeError: error()
      };
    }
    __name(default_1, "default_1");
    module2.exports = exports2.default;
  }
});

// node_modules/zod/v4/locales/sl.cjs
var require_sl = __commonJS({
  "node_modules/zod/v4/locales/sl.cjs"(exports2, module2) {
    "use strict";
    var __createBinding = exports2 && exports2.__createBinding || (Object.create ? (function(o, m, k, k2) {
      if (k2 === void 0) k2 = k;
      var desc = Object.getOwnPropertyDescriptor(m, k);
      if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
        desc = { enumerable: true, get: /* @__PURE__ */ __name(function() {
          return m[k];
        }, "get") };
      }
      Object.defineProperty(o, k2, desc);
    }) : (function(o, m, k, k2) {
      if (k2 === void 0) k2 = k;
      o[k2] = m[k];
    }));
    var __setModuleDefault = exports2 && exports2.__setModuleDefault || (Object.create ? (function(o, v) {
      Object.defineProperty(o, "default", { enumerable: true, value: v });
    }) : function(o, v) {
      o["default"] = v;
    });
    var __importStar = exports2 && exports2.__importStar || function(mod) {
      if (mod && mod.__esModule) return mod;
      var result = {};
      if (mod != null) {
        for (var k in mod) if (k !== "default" && Object.prototype.hasOwnProperty.call(mod, k)) __createBinding(result, mod, k);
      }
      __setModuleDefault(result, mod);
      return result;
    };
    Object.defineProperty(exports2, "__esModule", { value: true });
    exports2.default = default_1;
    var util = __importStar(require_util());
    var error = /* @__PURE__ */ __name(() => {
      const Sizable = {
        string: { unit: "znakov", verb: "imeti" },
        file: { unit: "bajtov", verb: "imeti" },
        array: { unit: "elementov", verb: "imeti" },
        set: { unit: "elementov", verb: "imeti" }
      };
      function getSizing(origin) {
        return Sizable[origin] ?? null;
      }
      __name(getSizing, "getSizing");
      const FormatDictionary = {
        regex: "vnos",
        email: "e-po\u0161tni naslov",
        url: "URL",
        emoji: "emoji",
        uuid: "UUID",
        uuidv4: "UUIDv4",
        uuidv6: "UUIDv6",
        nanoid: "nanoid",
        guid: "GUID",
        cuid: "cuid",
        cuid2: "cuid2",
        ulid: "ULID",
        xid: "XID",
        ksuid: "KSUID",
        datetime: "ISO datum in \u010Das",
        date: "ISO datum",
        time: "ISO \u010Das",
        duration: "ISO trajanje",
        ipv4: "IPv4 naslov",
        ipv6: "IPv6 naslov",
        cidrv4: "obseg IPv4",
        cidrv6: "obseg IPv6",
        base64: "base64 kodiran niz",
        base64url: "base64url kodiran niz",
        json_string: "JSON niz",
        e164: "E.164 \u0161tevilka",
        jwt: "JWT",
        template_literal: "vnos"
      };
      const TypeDictionary = {
        nan: "NaN",
        number: "\u0161tevilo",
        array: "tabela"
      };
      return (issue) => {
        switch (issue.code) {
          case "invalid_type": {
            const expected = TypeDictionary[issue.expected] ?? issue.expected;
            const receivedType = util.parsedType(issue.input);
            const received = TypeDictionary[receivedType] ?? receivedType;
            if (/^[A-Z]/.test(issue.expected)) {
              return `Neveljaven vnos: pri\u010Dakovano instanceof ${issue.expected}, prejeto ${received}`;
            }
            return `Neveljaven vnos: pri\u010Dakovano ${expected}, prejeto ${received}`;
          }
          case "invalid_value":
            if (issue.values.length === 1)
              return `Neveljaven vnos: pri\u010Dakovano ${util.stringifyPrimitive(issue.values[0])}`;
            return `Neveljavna mo\u017Enost: pri\u010Dakovano eno izmed ${util.joinValues(issue.values, "|")}`;
          case "too_big": {
            const adj = issue.inclusive ? "<=" : "<";
            const sizing = getSizing(issue.origin);
            if (sizing)
              return `Preveliko: pri\u010Dakovano, da bo ${issue.origin ?? "vrednost"} imelo ${adj}${issue.maximum.toString()} ${sizing.unit ?? "elementov"}`;
            return `Preveliko: pri\u010Dakovano, da bo ${issue.origin ?? "vrednost"} ${adj}${issue.maximum.toString()}`;
          }
          case "too_small": {
            const adj = issue.inclusive ? ">=" : ">";
            const sizing = getSizing(issue.origin);
            if (sizing) {
              return `Premajhno: pri\u010Dakovano, da bo ${issue.origin} imelo ${adj}${issue.minimum.toString()} ${sizing.unit}`;
            }
            return `Premajhno: pri\u010Dakovano, da bo ${issue.origin} ${adj}${issue.minimum.toString()}`;
          }
          case "invalid_format": {
            const _issue = issue;
            if (_issue.format === "starts_with") {
              return `Neveljaven niz: mora se za\u010Deti z "${_issue.prefix}"`;
            }
            if (_issue.format === "ends_with")
              return `Neveljaven niz: mora se kon\u010Dati z "${_issue.suffix}"`;
            if (_issue.format === "includes")
              return `Neveljaven niz: mora vsebovati "${_issue.includes}"`;
            if (_issue.format === "regex")
              return `Neveljaven niz: mora ustrezati vzorcu ${_issue.pattern}`;
            return `Neveljaven ${FormatDictionary[_issue.format] ?? issue.format}`;
          }
          case "not_multiple_of":
            return `Neveljavno \u0161tevilo: mora biti ve\u010Dkratnik ${issue.divisor}`;
          case "unrecognized_keys":
            return `Neprepoznan${issue.keys.length > 1 ? "i klju\u010Di" : " klju\u010D"}: ${util.joinValues(issue.keys, ", ")}`;
          case "invalid_key":
            return `Neveljaven klju\u010D v ${issue.origin}`;
          case "invalid_union":
            return "Neveljaven vnos";
          case "invalid_element":
            return `Neveljavna vrednost v ${issue.origin}`;
          default:
            return "Neveljaven vnos";
        }
      };
    }, "error");
    function default_1() {
      return {
        localeError: error()
      };
    }
    __name(default_1, "default_1");
    module2.exports = exports2.default;
  }
});

// node_modules/zod/v4/locales/sv.cjs
var require_sv = __commonJS({
  "node_modules/zod/v4/locales/sv.cjs"(exports2, module2) {
    "use strict";
    var __createBinding = exports2 && exports2.__createBinding || (Object.create ? (function(o, m, k, k2) {
      if (k2 === void 0) k2 = k;
      var desc = Object.getOwnPropertyDescriptor(m, k);
      if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
        desc = { enumerable: true, get: /* @__PURE__ */ __name(function() {
          return m[k];
        }, "get") };
      }
      Object.defineProperty(o, k2, desc);
    }) : (function(o, m, k, k2) {
      if (k2 === void 0) k2 = k;
      o[k2] = m[k];
    }));
    var __setModuleDefault = exports2 && exports2.__setModuleDefault || (Object.create ? (function(o, v) {
      Object.defineProperty(o, "default", { enumerable: true, value: v });
    }) : function(o, v) {
      o["default"] = v;
    });
    var __importStar = exports2 && exports2.__importStar || function(mod) {
      if (mod && mod.__esModule) return mod;
      var result = {};
      if (mod != null) {
        for (var k in mod) if (k !== "default" && Object.prototype.hasOwnProperty.call(mod, k)) __createBinding(result, mod, k);
      }
      __setModuleDefault(result, mod);
      return result;
    };
    Object.defineProperty(exports2, "__esModule", { value: true });
    exports2.default = default_1;
    var util = __importStar(require_util());
    var error = /* @__PURE__ */ __name(() => {
      const Sizable = {
        string: { unit: "tecken", verb: "att ha" },
        file: { unit: "bytes", verb: "att ha" },
        array: { unit: "objekt", verb: "att inneh\xE5lla" },
        set: { unit: "objekt", verb: "att inneh\xE5lla" }
      };
      function getSizing(origin) {
        return Sizable[origin] ?? null;
      }
      __name(getSizing, "getSizing");
      const FormatDictionary = {
        regex: "regulj\xE4rt uttryck",
        email: "e-postadress",
        url: "URL",
        emoji: "emoji",
        uuid: "UUID",
        uuidv4: "UUIDv4",
        uuidv6: "UUIDv6",
        nanoid: "nanoid",
        guid: "GUID",
        cuid: "cuid",
        cuid2: "cuid2",
        ulid: "ULID",
        xid: "XID",
        ksuid: "KSUID",
        datetime: "ISO-datum och tid",
        date: "ISO-datum",
        time: "ISO-tid",
        duration: "ISO-varaktighet",
        ipv4: "IPv4-intervall",
        ipv6: "IPv6-intervall",
        cidrv4: "IPv4-spektrum",
        cidrv6: "IPv6-spektrum",
        base64: "base64-kodad str\xE4ng",
        base64url: "base64url-kodad str\xE4ng",
        json_string: "JSON-str\xE4ng",
        e164: "E.164-nummer",
        jwt: "JWT",
        template_literal: "mall-literal"
      };
      const TypeDictionary = {
        nan: "NaN",
        number: "antal",
        array: "lista"
      };
      return (issue) => {
        switch (issue.code) {
          case "invalid_type": {
            const expected = TypeDictionary[issue.expected] ?? issue.expected;
            const receivedType = util.parsedType(issue.input);
            const received = TypeDictionary[receivedType] ?? receivedType;
            if (/^[A-Z]/.test(issue.expected)) {
              return `Ogiltig inmatning: f\xF6rv\xE4ntat instanceof ${issue.expected}, fick ${received}`;
            }
            return `Ogiltig inmatning: f\xF6rv\xE4ntat ${expected}, fick ${received}`;
          }
          case "invalid_value":
            if (issue.values.length === 1)
              return `Ogiltig inmatning: f\xF6rv\xE4ntat ${util.stringifyPrimitive(issue.values[0])}`;
            return `Ogiltigt val: f\xF6rv\xE4ntade en av ${util.joinValues(issue.values, "|")}`;
          case "too_big": {
            const adj = issue.inclusive ? "<=" : "<";
            const sizing = getSizing(issue.origin);
            if (sizing) {
              return `F\xF6r stor(t): f\xF6rv\xE4ntade ${issue.origin ?? "v\xE4rdet"} att ha ${adj}${issue.maximum.toString()} ${sizing.unit ?? "element"}`;
            }
            return `F\xF6r stor(t): f\xF6rv\xE4ntat ${issue.origin ?? "v\xE4rdet"} att ha ${adj}${issue.maximum.toString()}`;
          }
          case "too_small": {
            const adj = issue.inclusive ? ">=" : ">";
            const sizing = getSizing(issue.origin);
            if (sizing) {
              return `F\xF6r lite(t): f\xF6rv\xE4ntade ${issue.origin ?? "v\xE4rdet"} att ha ${adj}${issue.minimum.toString()} ${sizing.unit}`;
            }
            return `F\xF6r lite(t): f\xF6rv\xE4ntade ${issue.origin ?? "v\xE4rdet"} att ha ${adj}${issue.minimum.toString()}`;
          }
          case "invalid_format": {
            const _issue = issue;
            if (_issue.format === "starts_with") {
              return `Ogiltig str\xE4ng: m\xE5ste b\xF6rja med "${_issue.prefix}"`;
            }
            if (_issue.format === "ends_with")
              return `Ogiltig str\xE4ng: m\xE5ste sluta med "${_issue.suffix}"`;
            if (_issue.format === "includes")
              return `Ogiltig str\xE4ng: m\xE5ste inneh\xE5lla "${_issue.includes}"`;
            if (_issue.format === "regex")
              return `Ogiltig str\xE4ng: m\xE5ste matcha m\xF6nstret "${_issue.pattern}"`;
            return `Ogiltig(t) ${FormatDictionary[_issue.format] ?? issue.format}`;
          }
          case "not_multiple_of":
            return `Ogiltigt tal: m\xE5ste vara en multipel av ${issue.divisor}`;
          case "unrecognized_keys":
            return `${issue.keys.length > 1 ? "Ok\xE4nda nycklar" : "Ok\xE4nd nyckel"}: ${util.joinValues(issue.keys, ", ")}`;
          case "invalid_key":
            return `Ogiltig nyckel i ${issue.origin ?? "v\xE4rdet"}`;
          case "invalid_union":
            return "Ogiltig input";
          case "invalid_element":
            return `Ogiltigt v\xE4rde i ${issue.origin ?? "v\xE4rdet"}`;
          default:
            return `Ogiltig input`;
        }
      };
    }, "error");
    function default_1() {
      return {
        localeError: error()
      };
    }
    __name(default_1, "default_1");
    module2.exports = exports2.default;
  }
});

// node_modules/zod/v4/locales/ta.cjs
var require_ta = __commonJS({
  "node_modules/zod/v4/locales/ta.cjs"(exports2, module2) {
    "use strict";
    var __createBinding = exports2 && exports2.__createBinding || (Object.create ? (function(o, m, k, k2) {
      if (k2 === void 0) k2 = k;
      var desc = Object.getOwnPropertyDescriptor(m, k);
      if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
        desc = { enumerable: true, get: /* @__PURE__ */ __name(function() {
          return m[k];
        }, "get") };
      }
      Object.defineProperty(o, k2, desc);
    }) : (function(o, m, k, k2) {
      if (k2 === void 0) k2 = k;
      o[k2] = m[k];
    }));
    var __setModuleDefault = exports2 && exports2.__setModuleDefault || (Object.create ? (function(o, v) {
      Object.defineProperty(o, "default", { enumerable: true, value: v });
    }) : function(o, v) {
      o["default"] = v;
    });
    var __importStar = exports2 && exports2.__importStar || function(mod) {
      if (mod && mod.__esModule) return mod;
      var result = {};
      if (mod != null) {
        for (var k in mod) if (k !== "default" && Object.prototype.hasOwnProperty.call(mod, k)) __createBinding(result, mod, k);
      }
      __setModuleDefault(result, mod);
      return result;
    };
    Object.defineProperty(exports2, "__esModule", { value: true });
    exports2.default = default_1;
    var util = __importStar(require_util());
    var error = /* @__PURE__ */ __name(() => {
      const Sizable = {
        string: { unit: "\u0B8E\u0BB4\u0BC1\u0BA4\u0BCD\u0BA4\u0BC1\u0B95\u0BCD\u0B95\u0BB3\u0BCD", verb: "\u0B95\u0BCA\u0BA3\u0BCD\u0B9F\u0BBF\u0BB0\u0BC1\u0B95\u0BCD\u0B95 \u0BB5\u0BC7\u0BA3\u0BCD\u0B9F\u0BC1\u0BAE\u0BCD" },
        file: { unit: "\u0BAA\u0BC8\u0B9F\u0BCD\u0B9F\u0BC1\u0B95\u0BB3\u0BCD", verb: "\u0B95\u0BCA\u0BA3\u0BCD\u0B9F\u0BBF\u0BB0\u0BC1\u0B95\u0BCD\u0B95 \u0BB5\u0BC7\u0BA3\u0BCD\u0B9F\u0BC1\u0BAE\u0BCD" },
        array: { unit: "\u0B89\u0BB1\u0BC1\u0BAA\u0BCD\u0BAA\u0BC1\u0B95\u0BB3\u0BCD", verb: "\u0B95\u0BCA\u0BA3\u0BCD\u0B9F\u0BBF\u0BB0\u0BC1\u0B95\u0BCD\u0B95 \u0BB5\u0BC7\u0BA3\u0BCD\u0B9F\u0BC1\u0BAE\u0BCD" },
        set: { unit: "\u0B89\u0BB1\u0BC1\u0BAA\u0BCD\u0BAA\u0BC1\u0B95\u0BB3\u0BCD", verb: "\u0B95\u0BCA\u0BA3\u0BCD\u0B9F\u0BBF\u0BB0\u0BC1\u0B95\u0BCD\u0B95 \u0BB5\u0BC7\u0BA3\u0BCD\u0B9F\u0BC1\u0BAE\u0BCD" }
      };
      function getSizing(origin) {
        return Sizable[origin] ?? null;
      }
      __name(getSizing, "getSizing");
      const FormatDictionary = {
        regex: "\u0B89\u0BB3\u0BCD\u0BB3\u0BC0\u0B9F\u0BC1",
        email: "\u0BAE\u0BBF\u0BA9\u0BCD\u0BA9\u0B9E\u0BCD\u0B9A\u0BB2\u0BCD \u0BAE\u0BC1\u0B95\u0BB5\u0BB0\u0BBF",
        url: "URL",
        emoji: "emoji",
        uuid: "UUID",
        uuidv4: "UUIDv4",
        uuidv6: "UUIDv6",
        nanoid: "nanoid",
        guid: "GUID",
        cuid: "cuid",
        cuid2: "cuid2",
        ulid: "ULID",
        xid: "XID",
        ksuid: "KSUID",
        datetime: "ISO \u0BA4\u0BC7\u0BA4\u0BBF \u0BA8\u0BC7\u0BB0\u0BAE\u0BCD",
        date: "ISO \u0BA4\u0BC7\u0BA4\u0BBF",
        time: "ISO \u0BA8\u0BC7\u0BB0\u0BAE\u0BCD",
        duration: "ISO \u0B95\u0BBE\u0BB2 \u0B85\u0BB3\u0BB5\u0BC1",
        ipv4: "IPv4 \u0BAE\u0BC1\u0B95\u0BB5\u0BB0\u0BBF",
        ipv6: "IPv6 \u0BAE\u0BC1\u0B95\u0BB5\u0BB0\u0BBF",
        cidrv4: "IPv4 \u0BB5\u0BB0\u0BAE\u0BCD\u0BAA\u0BC1",
        cidrv6: "IPv6 \u0BB5\u0BB0\u0BAE\u0BCD\u0BAA\u0BC1",
        base64: "base64-encoded \u0B9A\u0BB0\u0BAE\u0BCD",
        base64url: "base64url-encoded \u0B9A\u0BB0\u0BAE\u0BCD",
        json_string: "JSON \u0B9A\u0BB0\u0BAE\u0BCD",
        e164: "E.164 \u0B8E\u0BA3\u0BCD",
        jwt: "JWT",
        template_literal: "input"
      };
      const TypeDictionary = {
        nan: "NaN",
        number: "\u0B8E\u0BA3\u0BCD",
        array: "\u0B85\u0BA3\u0BBF",
        null: "\u0BB5\u0BC6\u0BB1\u0BC1\u0BAE\u0BC8"
      };
      return (issue) => {
        switch (issue.code) {
          case "invalid_type": {
            const expected = TypeDictionary[issue.expected] ?? issue.expected;
            const receivedType = util.parsedType(issue.input);
            const received = TypeDictionary[receivedType] ?? receivedType;
            if (/^[A-Z]/.test(issue.expected)) {
              return `\u0BA4\u0BB5\u0BB1\u0BBE\u0BA9 \u0B89\u0BB3\u0BCD\u0BB3\u0BC0\u0B9F\u0BC1: \u0B8E\u0BA4\u0BBF\u0BB0\u0BCD\u0BAA\u0BBE\u0BB0\u0BCD\u0B95\u0BCD\u0B95\u0BAA\u0BCD\u0BAA\u0B9F\u0BCD\u0B9F\u0BA4\u0BC1 instanceof ${issue.expected}, \u0BAA\u0BC6\u0BB1\u0BAA\u0BCD\u0BAA\u0B9F\u0BCD\u0B9F\u0BA4\u0BC1 ${received}`;
            }
            return `\u0BA4\u0BB5\u0BB1\u0BBE\u0BA9 \u0B89\u0BB3\u0BCD\u0BB3\u0BC0\u0B9F\u0BC1: \u0B8E\u0BA4\u0BBF\u0BB0\u0BCD\u0BAA\u0BBE\u0BB0\u0BCD\u0B95\u0BCD\u0B95\u0BAA\u0BCD\u0BAA\u0B9F\u0BCD\u0B9F\u0BA4\u0BC1 ${expected}, \u0BAA\u0BC6\u0BB1\u0BAA\u0BCD\u0BAA\u0B9F\u0BCD\u0B9F\u0BA4\u0BC1 ${received}`;
          }
          case "invalid_value":
            if (issue.values.length === 1)
              return `\u0BA4\u0BB5\u0BB1\u0BBE\u0BA9 \u0B89\u0BB3\u0BCD\u0BB3\u0BC0\u0B9F\u0BC1: \u0B8E\u0BA4\u0BBF\u0BB0\u0BCD\u0BAA\u0BBE\u0BB0\u0BCD\u0B95\u0BCD\u0B95\u0BAA\u0BCD\u0BAA\u0B9F\u0BCD\u0B9F\u0BA4\u0BC1 ${util.stringifyPrimitive(issue.values[0])}`;
            return `\u0BA4\u0BB5\u0BB1\u0BBE\u0BA9 \u0BB5\u0BBF\u0BB0\u0BC1\u0BAA\u0BCD\u0BAA\u0BAE\u0BCD: \u0B8E\u0BA4\u0BBF\u0BB0\u0BCD\u0BAA\u0BBE\u0BB0\u0BCD\u0B95\u0BCD\u0B95\u0BAA\u0BCD\u0BAA\u0B9F\u0BCD\u0B9F\u0BA4\u0BC1 ${util.joinValues(issue.values, "|")} \u0B87\u0BB2\u0BCD \u0B92\u0BA9\u0BCD\u0BB1\u0BC1`;
          case "too_big": {
            const adj = issue.inclusive ? "<=" : "<";
            const sizing = getSizing(issue.origin);
            if (sizing) {
              return `\u0BAE\u0BBF\u0B95 \u0BAA\u0BC6\u0BB0\u0BBF\u0BAF\u0BA4\u0BC1: \u0B8E\u0BA4\u0BBF\u0BB0\u0BCD\u0BAA\u0BBE\u0BB0\u0BCD\u0B95\u0BCD\u0B95\u0BAA\u0BCD\u0BAA\u0B9F\u0BCD\u0B9F\u0BA4\u0BC1 ${issue.origin ?? "\u0BAE\u0BA4\u0BBF\u0BAA\u0BCD\u0BAA\u0BC1"} ${adj}${issue.maximum.toString()} ${sizing.unit ?? "\u0B89\u0BB1\u0BC1\u0BAA\u0BCD\u0BAA\u0BC1\u0B95\u0BB3\u0BCD"} \u0B86\u0B95 \u0B87\u0BB0\u0BC1\u0B95\u0BCD\u0B95 \u0BB5\u0BC7\u0BA3\u0BCD\u0B9F\u0BC1\u0BAE\u0BCD`;
            }
            return `\u0BAE\u0BBF\u0B95 \u0BAA\u0BC6\u0BB0\u0BBF\u0BAF\u0BA4\u0BC1: \u0B8E\u0BA4\u0BBF\u0BB0\u0BCD\u0BAA\u0BBE\u0BB0\u0BCD\u0B95\u0BCD\u0B95\u0BAA\u0BCD\u0BAA\u0B9F\u0BCD\u0B9F\u0BA4\u0BC1 ${issue.origin ?? "\u0BAE\u0BA4\u0BBF\u0BAA\u0BCD\u0BAA\u0BC1"} ${adj}${issue.maximum.toString()} \u0B86\u0B95 \u0B87\u0BB0\u0BC1\u0B95\u0BCD\u0B95 \u0BB5\u0BC7\u0BA3\u0BCD\u0B9F\u0BC1\u0BAE\u0BCD`;
          }
          case "too_small": {
            const adj = issue.inclusive ? ">=" : ">";
            const sizing = getSizing(issue.origin);
            if (sizing) {
              return `\u0BAE\u0BBF\u0B95\u0B9A\u0BCD \u0B9A\u0BBF\u0BB1\u0BBF\u0BAF\u0BA4\u0BC1: \u0B8E\u0BA4\u0BBF\u0BB0\u0BCD\u0BAA\u0BBE\u0BB0\u0BCD\u0B95\u0BCD\u0B95\u0BAA\u0BCD\u0BAA\u0B9F\u0BCD\u0B9F\u0BA4\u0BC1 ${issue.origin} ${adj}${issue.minimum.toString()} ${sizing.unit} \u0B86\u0B95 \u0B87\u0BB0\u0BC1\u0B95\u0BCD\u0B95 \u0BB5\u0BC7\u0BA3\u0BCD\u0B9F\u0BC1\u0BAE\u0BCD`;
            }
            return `\u0BAE\u0BBF\u0B95\u0B9A\u0BCD \u0B9A\u0BBF\u0BB1\u0BBF\u0BAF\u0BA4\u0BC1: \u0B8E\u0BA4\u0BBF\u0BB0\u0BCD\u0BAA\u0BBE\u0BB0\u0BCD\u0B95\u0BCD\u0B95\u0BAA\u0BCD\u0BAA\u0B9F\u0BCD\u0B9F\u0BA4\u0BC1 ${issue.origin} ${adj}${issue.minimum.toString()} \u0B86\u0B95 \u0B87\u0BB0\u0BC1\u0B95\u0BCD\u0B95 \u0BB5\u0BC7\u0BA3\u0BCD\u0B9F\u0BC1\u0BAE\u0BCD`;
          }
          case "invalid_format": {
            const _issue = issue;
            if (_issue.format === "starts_with")
              return `\u0BA4\u0BB5\u0BB1\u0BBE\u0BA9 \u0B9A\u0BB0\u0BAE\u0BCD: "${_issue.prefix}" \u0B87\u0BB2\u0BCD \u0BA4\u0BCA\u0B9F\u0B99\u0BCD\u0B95 \u0BB5\u0BC7\u0BA3\u0BCD\u0B9F\u0BC1\u0BAE\u0BCD`;
            if (_issue.format === "ends_with")
              return `\u0BA4\u0BB5\u0BB1\u0BBE\u0BA9 \u0B9A\u0BB0\u0BAE\u0BCD: "${_issue.suffix}" \u0B87\u0BB2\u0BCD \u0BAE\u0BC1\u0B9F\u0BBF\u0BB5\u0B9F\u0BC8\u0BAF \u0BB5\u0BC7\u0BA3\u0BCD\u0B9F\u0BC1\u0BAE\u0BCD`;
            if (_issue.format === "includes")
              return `\u0BA4\u0BB5\u0BB1\u0BBE\u0BA9 \u0B9A\u0BB0\u0BAE\u0BCD: "${_issue.includes}" \u0B90 \u0B89\u0BB3\u0BCD\u0BB3\u0B9F\u0B95\u0BCD\u0B95 \u0BB5\u0BC7\u0BA3\u0BCD\u0B9F\u0BC1\u0BAE\u0BCD`;
            if (_issue.format === "regex")
              return `\u0BA4\u0BB5\u0BB1\u0BBE\u0BA9 \u0B9A\u0BB0\u0BAE\u0BCD: ${_issue.pattern} \u0BAE\u0BC1\u0BB1\u0BC8\u0BAA\u0BBE\u0B9F\u0BCD\u0B9F\u0BC1\u0B9F\u0BA9\u0BCD \u0BAA\u0BCA\u0BB0\u0BC1\u0BA8\u0BCD\u0BA4 \u0BB5\u0BC7\u0BA3\u0BCD\u0B9F\u0BC1\u0BAE\u0BCD`;
            return `\u0BA4\u0BB5\u0BB1\u0BBE\u0BA9 ${FormatDictionary[_issue.format] ?? issue.format}`;
          }
          case "not_multiple_of":
            return `\u0BA4\u0BB5\u0BB1\u0BBE\u0BA9 \u0B8E\u0BA3\u0BCD: ${issue.divisor} \u0B87\u0BA9\u0BCD \u0BAA\u0BB2\u0BAE\u0BBE\u0B95 \u0B87\u0BB0\u0BC1\u0B95\u0BCD\u0B95 \u0BB5\u0BC7\u0BA3\u0BCD\u0B9F\u0BC1\u0BAE\u0BCD`;
          case "unrecognized_keys":
            return `\u0B85\u0B9F\u0BC8\u0BAF\u0BBE\u0BB3\u0BAE\u0BCD \u0BA4\u0BC6\u0BB0\u0BBF\u0BAF\u0BBE\u0BA4 \u0BB5\u0BBF\u0B9A\u0BC8${issue.keys.length > 1 ? "\u0B95\u0BB3\u0BCD" : ""}: ${util.joinValues(issue.keys, ", ")}`;
          case "invalid_key":
            return `${issue.origin} \u0B87\u0BB2\u0BCD \u0BA4\u0BB5\u0BB1\u0BBE\u0BA9 \u0BB5\u0BBF\u0B9A\u0BC8`;
          case "invalid_union":
            return "\u0BA4\u0BB5\u0BB1\u0BBE\u0BA9 \u0B89\u0BB3\u0BCD\u0BB3\u0BC0\u0B9F\u0BC1";
          case "invalid_element":
            return `${issue.origin} \u0B87\u0BB2\u0BCD \u0BA4\u0BB5\u0BB1\u0BBE\u0BA9 \u0BAE\u0BA4\u0BBF\u0BAA\u0BCD\u0BAA\u0BC1`;
          default:
            return `\u0BA4\u0BB5\u0BB1\u0BBE\u0BA9 \u0B89\u0BB3\u0BCD\u0BB3\u0BC0\u0B9F\u0BC1`;
        }
      };
    }, "error");
    function default_1() {
      return {
        localeError: error()
      };
    }
    __name(default_1, "default_1");
    module2.exports = exports2.default;
  }
});

// node_modules/zod/v4/locales/th.cjs
var require_th = __commonJS({
  "node_modules/zod/v4/locales/th.cjs"(exports2, module2) {
    "use strict";
    var __createBinding = exports2 && exports2.__createBinding || (Object.create ? (function(o, m, k, k2) {
      if (k2 === void 0) k2 = k;
      var desc = Object.getOwnPropertyDescriptor(m, k);
      if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
        desc = { enumerable: true, get: /* @__PURE__ */ __name(function() {
          return m[k];
        }, "get") };
      }
      Object.defineProperty(o, k2, desc);
    }) : (function(o, m, k, k2) {
      if (k2 === void 0) k2 = k;
      o[k2] = m[k];
    }));
    var __setModuleDefault = exports2 && exports2.__setModuleDefault || (Object.create ? (function(o, v) {
      Object.defineProperty(o, "default", { enumerable: true, value: v });
    }) : function(o, v) {
      o["default"] = v;
    });
    var __importStar = exports2 && exports2.__importStar || function(mod) {
      if (mod && mod.__esModule) return mod;
      var result = {};
      if (mod != null) {
        for (var k in mod) if (k !== "default" && Object.prototype.hasOwnProperty.call(mod, k)) __createBinding(result, mod, k);
      }
      __setModuleDefault(result, mod);
      return result;
    };
    Object.defineProperty(exports2, "__esModule", { value: true });
    exports2.default = default_1;
    var util = __importStar(require_util());
    var error = /* @__PURE__ */ __name(() => {
      const Sizable = {
        string: { unit: "\u0E15\u0E31\u0E27\u0E2D\u0E31\u0E01\u0E29\u0E23", verb: "\u0E04\u0E27\u0E23\u0E21\u0E35" },
        file: { unit: "\u0E44\u0E1A\u0E15\u0E4C", verb: "\u0E04\u0E27\u0E23\u0E21\u0E35" },
        array: { unit: "\u0E23\u0E32\u0E22\u0E01\u0E32\u0E23", verb: "\u0E04\u0E27\u0E23\u0E21\u0E35" },
        set: { unit: "\u0E23\u0E32\u0E22\u0E01\u0E32\u0E23", verb: "\u0E04\u0E27\u0E23\u0E21\u0E35" }
      };
      function getSizing(origin) {
        return Sizable[origin] ?? null;
      }
      __name(getSizing, "getSizing");
      const FormatDictionary = {
        regex: "\u0E02\u0E49\u0E2D\u0E21\u0E39\u0E25\u0E17\u0E35\u0E48\u0E1B\u0E49\u0E2D\u0E19",
        email: "\u0E17\u0E35\u0E48\u0E2D\u0E22\u0E39\u0E48\u0E2D\u0E35\u0E40\u0E21\u0E25",
        url: "URL",
        emoji: "\u0E2D\u0E34\u0E42\u0E21\u0E08\u0E34",
        uuid: "UUID",
        uuidv4: "UUIDv4",
        uuidv6: "UUIDv6",
        nanoid: "nanoid",
        guid: "GUID",
        cuid: "cuid",
        cuid2: "cuid2",
        ulid: "ULID",
        xid: "XID",
        ksuid: "KSUID",
        datetime: "\u0E27\u0E31\u0E19\u0E17\u0E35\u0E48\u0E40\u0E27\u0E25\u0E32\u0E41\u0E1A\u0E1A ISO",
        date: "\u0E27\u0E31\u0E19\u0E17\u0E35\u0E48\u0E41\u0E1A\u0E1A ISO",
        time: "\u0E40\u0E27\u0E25\u0E32\u0E41\u0E1A\u0E1A ISO",
        duration: "\u0E0A\u0E48\u0E27\u0E07\u0E40\u0E27\u0E25\u0E32\u0E41\u0E1A\u0E1A ISO",
        ipv4: "\u0E17\u0E35\u0E48\u0E2D\u0E22\u0E39\u0E48 IPv4",
        ipv6: "\u0E17\u0E35\u0E48\u0E2D\u0E22\u0E39\u0E48 IPv6",
        cidrv4: "\u0E0A\u0E48\u0E27\u0E07 IP \u0E41\u0E1A\u0E1A IPv4",
        cidrv6: "\u0E0A\u0E48\u0E27\u0E07 IP \u0E41\u0E1A\u0E1A IPv6",
        base64: "\u0E02\u0E49\u0E2D\u0E04\u0E27\u0E32\u0E21\u0E41\u0E1A\u0E1A Base64",
        base64url: "\u0E02\u0E49\u0E2D\u0E04\u0E27\u0E32\u0E21\u0E41\u0E1A\u0E1A Base64 \u0E2A\u0E33\u0E2B\u0E23\u0E31\u0E1A URL",
        json_string: "\u0E02\u0E49\u0E2D\u0E04\u0E27\u0E32\u0E21\u0E41\u0E1A\u0E1A JSON",
        e164: "\u0E40\u0E1A\u0E2D\u0E23\u0E4C\u0E42\u0E17\u0E23\u0E28\u0E31\u0E1E\u0E17\u0E4C\u0E23\u0E30\u0E2B\u0E27\u0E48\u0E32\u0E07\u0E1B\u0E23\u0E30\u0E40\u0E17\u0E28 (E.164)",
        jwt: "\u0E42\u0E17\u0E40\u0E04\u0E19 JWT",
        template_literal: "\u0E02\u0E49\u0E2D\u0E21\u0E39\u0E25\u0E17\u0E35\u0E48\u0E1B\u0E49\u0E2D\u0E19"
      };
      const TypeDictionary = {
        nan: "NaN",
        number: "\u0E15\u0E31\u0E27\u0E40\u0E25\u0E02",
        array: "\u0E2D\u0E32\u0E23\u0E4C\u0E40\u0E23\u0E22\u0E4C (Array)",
        null: "\u0E44\u0E21\u0E48\u0E21\u0E35\u0E04\u0E48\u0E32 (null)"
      };
      return (issue) => {
        switch (issue.code) {
          case "invalid_type": {
            const expected = TypeDictionary[issue.expected] ?? issue.expected;
            const receivedType = util.parsedType(issue.input);
            const received = TypeDictionary[receivedType] ?? receivedType;
            if (/^[A-Z]/.test(issue.expected)) {
              return `\u0E1B\u0E23\u0E30\u0E40\u0E20\u0E17\u0E02\u0E49\u0E2D\u0E21\u0E39\u0E25\u0E44\u0E21\u0E48\u0E16\u0E39\u0E01\u0E15\u0E49\u0E2D\u0E07: \u0E04\u0E27\u0E23\u0E40\u0E1B\u0E47\u0E19 instanceof ${issue.expected} \u0E41\u0E15\u0E48\u0E44\u0E14\u0E49\u0E23\u0E31\u0E1A ${received}`;
            }
            return `\u0E1B\u0E23\u0E30\u0E40\u0E20\u0E17\u0E02\u0E49\u0E2D\u0E21\u0E39\u0E25\u0E44\u0E21\u0E48\u0E16\u0E39\u0E01\u0E15\u0E49\u0E2D\u0E07: \u0E04\u0E27\u0E23\u0E40\u0E1B\u0E47\u0E19 ${expected} \u0E41\u0E15\u0E48\u0E44\u0E14\u0E49\u0E23\u0E31\u0E1A ${received}`;
          }
          case "invalid_value":
            if (issue.values.length === 1)
              return `\u0E04\u0E48\u0E32\u0E44\u0E21\u0E48\u0E16\u0E39\u0E01\u0E15\u0E49\u0E2D\u0E07: \u0E04\u0E27\u0E23\u0E40\u0E1B\u0E47\u0E19 ${util.stringifyPrimitive(issue.values[0])}`;
            return `\u0E15\u0E31\u0E27\u0E40\u0E25\u0E37\u0E2D\u0E01\u0E44\u0E21\u0E48\u0E16\u0E39\u0E01\u0E15\u0E49\u0E2D\u0E07: \u0E04\u0E27\u0E23\u0E40\u0E1B\u0E47\u0E19\u0E2B\u0E19\u0E36\u0E48\u0E07\u0E43\u0E19 ${util.joinValues(issue.values, "|")}`;
          case "too_big": {
            const adj = issue.inclusive ? "\u0E44\u0E21\u0E48\u0E40\u0E01\u0E34\u0E19" : "\u0E19\u0E49\u0E2D\u0E22\u0E01\u0E27\u0E48\u0E32";
            const sizing = getSizing(issue.origin);
            if (sizing)
              return `\u0E40\u0E01\u0E34\u0E19\u0E01\u0E33\u0E2B\u0E19\u0E14: ${issue.origin ?? "\u0E04\u0E48\u0E32"} \u0E04\u0E27\u0E23\u0E21\u0E35${adj} ${issue.maximum.toString()} ${sizing.unit ?? "\u0E23\u0E32\u0E22\u0E01\u0E32\u0E23"}`;
            return `\u0E40\u0E01\u0E34\u0E19\u0E01\u0E33\u0E2B\u0E19\u0E14: ${issue.origin ?? "\u0E04\u0E48\u0E32"} \u0E04\u0E27\u0E23\u0E21\u0E35${adj} ${issue.maximum.toString()}`;
          }
          case "too_small": {
            const adj = issue.inclusive ? "\u0E2D\u0E22\u0E48\u0E32\u0E07\u0E19\u0E49\u0E2D\u0E22" : "\u0E21\u0E32\u0E01\u0E01\u0E27\u0E48\u0E32";
            const sizing = getSizing(issue.origin);
            if (sizing) {
              return `\u0E19\u0E49\u0E2D\u0E22\u0E01\u0E27\u0E48\u0E32\u0E01\u0E33\u0E2B\u0E19\u0E14: ${issue.origin} \u0E04\u0E27\u0E23\u0E21\u0E35${adj} ${issue.minimum.toString()} ${sizing.unit}`;
            }
            return `\u0E19\u0E49\u0E2D\u0E22\u0E01\u0E27\u0E48\u0E32\u0E01\u0E33\u0E2B\u0E19\u0E14: ${issue.origin} \u0E04\u0E27\u0E23\u0E21\u0E35${adj} ${issue.minimum.toString()}`;
          }
          case "invalid_format": {
            const _issue = issue;
            if (_issue.format === "starts_with") {
              return `\u0E23\u0E39\u0E1B\u0E41\u0E1A\u0E1A\u0E44\u0E21\u0E48\u0E16\u0E39\u0E01\u0E15\u0E49\u0E2D\u0E07: \u0E02\u0E49\u0E2D\u0E04\u0E27\u0E32\u0E21\u0E15\u0E49\u0E2D\u0E07\u0E02\u0E36\u0E49\u0E19\u0E15\u0E49\u0E19\u0E14\u0E49\u0E27\u0E22 "${_issue.prefix}"`;
            }
            if (_issue.format === "ends_with")
              return `\u0E23\u0E39\u0E1B\u0E41\u0E1A\u0E1A\u0E44\u0E21\u0E48\u0E16\u0E39\u0E01\u0E15\u0E49\u0E2D\u0E07: \u0E02\u0E49\u0E2D\u0E04\u0E27\u0E32\u0E21\u0E15\u0E49\u0E2D\u0E07\u0E25\u0E07\u0E17\u0E49\u0E32\u0E22\u0E14\u0E49\u0E27\u0E22 "${_issue.suffix}"`;
            if (_issue.format === "includes")
              return `\u0E23\u0E39\u0E1B\u0E41\u0E1A\u0E1A\u0E44\u0E21\u0E48\u0E16\u0E39\u0E01\u0E15\u0E49\u0E2D\u0E07: \u0E02\u0E49\u0E2D\u0E04\u0E27\u0E32\u0E21\u0E15\u0E49\u0E2D\u0E07\u0E21\u0E35 "${_issue.includes}" \u0E2D\u0E22\u0E39\u0E48\u0E43\u0E19\u0E02\u0E49\u0E2D\u0E04\u0E27\u0E32\u0E21`;
            if (_issue.format === "regex")
              return `\u0E23\u0E39\u0E1B\u0E41\u0E1A\u0E1A\u0E44\u0E21\u0E48\u0E16\u0E39\u0E01\u0E15\u0E49\u0E2D\u0E07: \u0E15\u0E49\u0E2D\u0E07\u0E15\u0E23\u0E07\u0E01\u0E31\u0E1A\u0E23\u0E39\u0E1B\u0E41\u0E1A\u0E1A\u0E17\u0E35\u0E48\u0E01\u0E33\u0E2B\u0E19\u0E14 ${_issue.pattern}`;
            return `\u0E23\u0E39\u0E1B\u0E41\u0E1A\u0E1A\u0E44\u0E21\u0E48\u0E16\u0E39\u0E01\u0E15\u0E49\u0E2D\u0E07: ${FormatDictionary[_issue.format] ?? issue.format}`;
          }
          case "not_multiple_of":
            return `\u0E15\u0E31\u0E27\u0E40\u0E25\u0E02\u0E44\u0E21\u0E48\u0E16\u0E39\u0E01\u0E15\u0E49\u0E2D\u0E07: \u0E15\u0E49\u0E2D\u0E07\u0E40\u0E1B\u0E47\u0E19\u0E08\u0E33\u0E19\u0E27\u0E19\u0E17\u0E35\u0E48\u0E2B\u0E32\u0E23\u0E14\u0E49\u0E27\u0E22 ${issue.divisor} \u0E44\u0E14\u0E49\u0E25\u0E07\u0E15\u0E31\u0E27`;
          case "unrecognized_keys":
            return `\u0E1E\u0E1A\u0E04\u0E35\u0E22\u0E4C\u0E17\u0E35\u0E48\u0E44\u0E21\u0E48\u0E23\u0E39\u0E49\u0E08\u0E31\u0E01: ${util.joinValues(issue.keys, ", ")}`;
          case "invalid_key":
            return `\u0E04\u0E35\u0E22\u0E4C\u0E44\u0E21\u0E48\u0E16\u0E39\u0E01\u0E15\u0E49\u0E2D\u0E07\u0E43\u0E19 ${issue.origin}`;
          case "invalid_union":
            return "\u0E02\u0E49\u0E2D\u0E21\u0E39\u0E25\u0E44\u0E21\u0E48\u0E16\u0E39\u0E01\u0E15\u0E49\u0E2D\u0E07: \u0E44\u0E21\u0E48\u0E15\u0E23\u0E07\u0E01\u0E31\u0E1A\u0E23\u0E39\u0E1B\u0E41\u0E1A\u0E1A\u0E22\u0E39\u0E40\u0E19\u0E35\u0E22\u0E19\u0E17\u0E35\u0E48\u0E01\u0E33\u0E2B\u0E19\u0E14\u0E44\u0E27\u0E49";
          case "invalid_element":
            return `\u0E02\u0E49\u0E2D\u0E21\u0E39\u0E25\u0E44\u0E21\u0E48\u0E16\u0E39\u0E01\u0E15\u0E49\u0E2D\u0E07\u0E43\u0E19 ${issue.origin}`;
          default:
            return `\u0E02\u0E49\u0E2D\u0E21\u0E39\u0E25\u0E44\u0E21\u0E48\u0E16\u0E39\u0E01\u0E15\u0E49\u0E2D\u0E07`;
        }
      };
    }, "error");
    function default_1() {
      return {
        localeError: error()
      };
    }
    __name(default_1, "default_1");
    module2.exports = exports2.default;
  }
});

// node_modules/zod/v4/locales/tr.cjs
var require_tr = __commonJS({
  "node_modules/zod/v4/locales/tr.cjs"(exports2, module2) {
    "use strict";
    var __createBinding = exports2 && exports2.__createBinding || (Object.create ? (function(o, m, k, k2) {
      if (k2 === void 0) k2 = k;
      var desc = Object.getOwnPropertyDescriptor(m, k);
      if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
        desc = { enumerable: true, get: /* @__PURE__ */ __name(function() {
          return m[k];
        }, "get") };
      }
      Object.defineProperty(o, k2, desc);
    }) : (function(o, m, k, k2) {
      if (k2 === void 0) k2 = k;
      o[k2] = m[k];
    }));
    var __setModuleDefault = exports2 && exports2.__setModuleDefault || (Object.create ? (function(o, v) {
      Object.defineProperty(o, "default", { enumerable: true, value: v });
    }) : function(o, v) {
      o["default"] = v;
    });
    var __importStar = exports2 && exports2.__importStar || function(mod) {
      if (mod && mod.__esModule) return mod;
      var result = {};
      if (mod != null) {
        for (var k in mod) if (k !== "default" && Object.prototype.hasOwnProperty.call(mod, k)) __createBinding(result, mod, k);
      }
      __setModuleDefault(result, mod);
      return result;
    };
    Object.defineProperty(exports2, "__esModule", { value: true });
    exports2.default = default_1;
    var util = __importStar(require_util());
    var error = /* @__PURE__ */ __name(() => {
      const Sizable = {
        string: { unit: "karakter", verb: "olmal\u0131" },
        file: { unit: "bayt", verb: "olmal\u0131" },
        array: { unit: "\xF6\u011Fe", verb: "olmal\u0131" },
        set: { unit: "\xF6\u011Fe", verb: "olmal\u0131" }
      };
      function getSizing(origin) {
        return Sizable[origin] ?? null;
      }
      __name(getSizing, "getSizing");
      const FormatDictionary = {
        regex: "girdi",
        email: "e-posta adresi",
        url: "URL",
        emoji: "emoji",
        uuid: "UUID",
        uuidv4: "UUIDv4",
        uuidv6: "UUIDv6",
        nanoid: "nanoid",
        guid: "GUID",
        cuid: "cuid",
        cuid2: "cuid2",
        ulid: "ULID",
        xid: "XID",
        ksuid: "KSUID",
        datetime: "ISO tarih ve saat",
        date: "ISO tarih",
        time: "ISO saat",
        duration: "ISO s\xFCre",
        ipv4: "IPv4 adresi",
        ipv6: "IPv6 adresi",
        cidrv4: "IPv4 aral\u0131\u011F\u0131",
        cidrv6: "IPv6 aral\u0131\u011F\u0131",
        base64: "base64 ile \u015Fifrelenmi\u015F metin",
        base64url: "base64url ile \u015Fifrelenmi\u015F metin",
        json_string: "JSON dizesi",
        e164: "E.164 say\u0131s\u0131",
        jwt: "JWT",
        template_literal: "\u015Eablon dizesi"
      };
      const TypeDictionary = {
        nan: "NaN"
      };
      return (issue) => {
        switch (issue.code) {
          case "invalid_type": {
            const expected = TypeDictionary[issue.expected] ?? issue.expected;
            const receivedType = util.parsedType(issue.input);
            const received = TypeDictionary[receivedType] ?? receivedType;
            if (/^[A-Z]/.test(issue.expected)) {
              return `Ge\xE7ersiz de\u011Fer: beklenen instanceof ${issue.expected}, al\u0131nan ${received}`;
            }
            return `Ge\xE7ersiz de\u011Fer: beklenen ${expected}, al\u0131nan ${received}`;
          }
          case "invalid_value":
            if (issue.values.length === 1)
              return `Ge\xE7ersiz de\u011Fer: beklenen ${util.stringifyPrimitive(issue.values[0])}`;
            return `Ge\xE7ersiz se\xE7enek: a\u015Fa\u011F\u0131dakilerden biri olmal\u0131: ${util.joinValues(issue.values, "|")}`;
          case "too_big": {
            const adj = issue.inclusive ? "<=" : "<";
            const sizing = getSizing(issue.origin);
            if (sizing)
              return `\xC7ok b\xFCy\xFCk: beklenen ${issue.origin ?? "de\u011Fer"} ${adj}${issue.maximum.toString()} ${sizing.unit ?? "\xF6\u011Fe"}`;
            return `\xC7ok b\xFCy\xFCk: beklenen ${issue.origin ?? "de\u011Fer"} ${adj}${issue.maximum.toString()}`;
          }
          case "too_small": {
            const adj = issue.inclusive ? ">=" : ">";
            const sizing = getSizing(issue.origin);
            if (sizing)
              return `\xC7ok k\xFC\xE7\xFCk: beklenen ${issue.origin} ${adj}${issue.minimum.toString()} ${sizing.unit}`;
            return `\xC7ok k\xFC\xE7\xFCk: beklenen ${issue.origin} ${adj}${issue.minimum.toString()}`;
          }
          case "invalid_format": {
            const _issue = issue;
            if (_issue.format === "starts_with")
              return `Ge\xE7ersiz metin: "${_issue.prefix}" ile ba\u015Flamal\u0131`;
            if (_issue.format === "ends_with")
              return `Ge\xE7ersiz metin: "${_issue.suffix}" ile bitmeli`;
            if (_issue.format === "includes")
              return `Ge\xE7ersiz metin: "${_issue.includes}" i\xE7ermeli`;
            if (_issue.format === "regex")
              return `Ge\xE7ersiz metin: ${_issue.pattern} desenine uymal\u0131`;
            return `Ge\xE7ersiz ${FormatDictionary[_issue.format] ?? issue.format}`;
          }
          case "not_multiple_of":
            return `Ge\xE7ersiz say\u0131: ${issue.divisor} ile tam b\xF6l\xFCnebilmeli`;
          case "unrecognized_keys":
            return `Tan\u0131nmayan anahtar${issue.keys.length > 1 ? "lar" : ""}: ${util.joinValues(issue.keys, ", ")}`;
          case "invalid_key":
            return `${issue.origin} i\xE7inde ge\xE7ersiz anahtar`;
          case "invalid_union":
            return "Ge\xE7ersiz de\u011Fer";
          case "invalid_element":
            return `${issue.origin} i\xE7inde ge\xE7ersiz de\u011Fer`;
          default:
            return `Ge\xE7ersiz de\u011Fer`;
        }
      };
    }, "error");
    function default_1() {
      return {
        localeError: error()
      };
    }
    __name(default_1, "default_1");
    module2.exports = exports2.default;
  }
});

// node_modules/zod/v4/locales/uk.cjs
var require_uk = __commonJS({
  "node_modules/zod/v4/locales/uk.cjs"(exports2, module2) {
    "use strict";
    var __createBinding = exports2 && exports2.__createBinding || (Object.create ? (function(o, m, k, k2) {
      if (k2 === void 0) k2 = k;
      var desc = Object.getOwnPropertyDescriptor(m, k);
      if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
        desc = { enumerable: true, get: /* @__PURE__ */ __name(function() {
          return m[k];
        }, "get") };
      }
      Object.defineProperty(o, k2, desc);
    }) : (function(o, m, k, k2) {
      if (k2 === void 0) k2 = k;
      o[k2] = m[k];
    }));
    var __setModuleDefault = exports2 && exports2.__setModuleDefault || (Object.create ? (function(o, v) {
      Object.defineProperty(o, "default", { enumerable: true, value: v });
    }) : function(o, v) {
      o["default"] = v;
    });
    var __importStar = exports2 && exports2.__importStar || function(mod) {
      if (mod && mod.__esModule) return mod;
      var result = {};
      if (mod != null) {
        for (var k in mod) if (k !== "default" && Object.prototype.hasOwnProperty.call(mod, k)) __createBinding(result, mod, k);
      }
      __setModuleDefault(result, mod);
      return result;
    };
    Object.defineProperty(exports2, "__esModule", { value: true });
    exports2.default = default_1;
    var util = __importStar(require_util());
    var error = /* @__PURE__ */ __name(() => {
      const Sizable = {
        string: { unit: "\u0441\u0438\u043C\u0432\u043E\u043B\u0456\u0432", verb: "\u043C\u0430\u0442\u0438\u043C\u0435" },
        file: { unit: "\u0431\u0430\u0439\u0442\u0456\u0432", verb: "\u043C\u0430\u0442\u0438\u043C\u0435" },
        array: { unit: "\u0435\u043B\u0435\u043C\u0435\u043D\u0442\u0456\u0432", verb: "\u043C\u0430\u0442\u0438\u043C\u0435" },
        set: { unit: "\u0435\u043B\u0435\u043C\u0435\u043D\u0442\u0456\u0432", verb: "\u043C\u0430\u0442\u0438\u043C\u0435" }
      };
      function getSizing(origin) {
        return Sizable[origin] ?? null;
      }
      __name(getSizing, "getSizing");
      const FormatDictionary = {
        regex: "\u0432\u0445\u0456\u0434\u043D\u0456 \u0434\u0430\u043D\u0456",
        email: "\u0430\u0434\u0440\u0435\u0441\u0430 \u0435\u043B\u0435\u043A\u0442\u0440\u043E\u043D\u043D\u043E\u0457 \u043F\u043E\u0448\u0442\u0438",
        url: "URL",
        emoji: "\u0435\u043C\u043E\u0434\u0437\u0456",
        uuid: "UUID",
        uuidv4: "UUIDv4",
        uuidv6: "UUIDv6",
        nanoid: "nanoid",
        guid: "GUID",
        cuid: "cuid",
        cuid2: "cuid2",
        ulid: "ULID",
        xid: "XID",
        ksuid: "KSUID",
        datetime: "\u0434\u0430\u0442\u0430 \u0442\u0430 \u0447\u0430\u0441 ISO",
        date: "\u0434\u0430\u0442\u0430 ISO",
        time: "\u0447\u0430\u0441 ISO",
        duration: "\u0442\u0440\u0438\u0432\u0430\u043B\u0456\u0441\u0442\u044C ISO",
        ipv4: "\u0430\u0434\u0440\u0435\u0441\u0430 IPv4",
        ipv6: "\u0430\u0434\u0440\u0435\u0441\u0430 IPv6",
        cidrv4: "\u0434\u0456\u0430\u043F\u0430\u0437\u043E\u043D IPv4",
        cidrv6: "\u0434\u0456\u0430\u043F\u0430\u0437\u043E\u043D IPv6",
        base64: "\u0440\u044F\u0434\u043E\u043A \u0443 \u043A\u043E\u0434\u0443\u0432\u0430\u043D\u043D\u0456 base64",
        base64url: "\u0440\u044F\u0434\u043E\u043A \u0443 \u043A\u043E\u0434\u0443\u0432\u0430\u043D\u043D\u0456 base64url",
        json_string: "\u0440\u044F\u0434\u043E\u043A JSON",
        e164: "\u043D\u043E\u043C\u0435\u0440 E.164",
        jwt: "JWT",
        template_literal: "\u0432\u0445\u0456\u0434\u043D\u0456 \u0434\u0430\u043D\u0456"
      };
      const TypeDictionary = {
        nan: "NaN",
        number: "\u0447\u0438\u0441\u043B\u043E",
        array: "\u043C\u0430\u0441\u0438\u0432"
      };
      return (issue) => {
        switch (issue.code) {
          case "invalid_type": {
            const expected = TypeDictionary[issue.expected] ?? issue.expected;
            const receivedType = util.parsedType(issue.input);
            const received = TypeDictionary[receivedType] ?? receivedType;
            if (/^[A-Z]/.test(issue.expected)) {
              return `\u041D\u0435\u043F\u0440\u0430\u0432\u0438\u043B\u044C\u043D\u0456 \u0432\u0445\u0456\u0434\u043D\u0456 \u0434\u0430\u043D\u0456: \u043E\u0447\u0456\u043A\u0443\u0454\u0442\u044C\u0441\u044F instanceof ${issue.expected}, \u043E\u0442\u0440\u0438\u043C\u0430\u043D\u043E ${received}`;
            }
            return `\u041D\u0435\u043F\u0440\u0430\u0432\u0438\u043B\u044C\u043D\u0456 \u0432\u0445\u0456\u0434\u043D\u0456 \u0434\u0430\u043D\u0456: \u043E\u0447\u0456\u043A\u0443\u0454\u0442\u044C\u0441\u044F ${expected}, \u043E\u0442\u0440\u0438\u043C\u0430\u043D\u043E ${received}`;
          }
          case "invalid_value":
            if (issue.values.length === 1)
              return `\u041D\u0435\u043F\u0440\u0430\u0432\u0438\u043B\u044C\u043D\u0456 \u0432\u0445\u0456\u0434\u043D\u0456 \u0434\u0430\u043D\u0456: \u043E\u0447\u0456\u043A\u0443\u0454\u0442\u044C\u0441\u044F ${util.stringifyPrimitive(issue.values[0])}`;
            return `\u041D\u0435\u043F\u0440\u0430\u0432\u0438\u043B\u044C\u043D\u0430 \u043E\u043F\u0446\u0456\u044F: \u043E\u0447\u0456\u043A\u0443\u0454\u0442\u044C\u0441\u044F \u043E\u0434\u043D\u0435 \u0437 ${util.joinValues(issue.values, "|")}`;
          case "too_big": {
            const adj = issue.inclusive ? "<=" : "<";
            const sizing = getSizing(issue.origin);
            if (sizing)
              return `\u0417\u0430\u043D\u0430\u0434\u0442\u043E \u0432\u0435\u043B\u0438\u043A\u0435: \u043E\u0447\u0456\u043A\u0443\u0454\u0442\u044C\u0441\u044F, \u0449\u043E ${issue.origin ?? "\u0437\u043D\u0430\u0447\u0435\u043D\u043D\u044F"} ${sizing.verb} ${adj}${issue.maximum.toString()} ${sizing.unit ?? "\u0435\u043B\u0435\u043C\u0435\u043D\u0442\u0456\u0432"}`;
            return `\u0417\u0430\u043D\u0430\u0434\u0442\u043E \u0432\u0435\u043B\u0438\u043A\u0435: \u043E\u0447\u0456\u043A\u0443\u0454\u0442\u044C\u0441\u044F, \u0449\u043E ${issue.origin ?? "\u0437\u043D\u0430\u0447\u0435\u043D\u043D\u044F"} \u0431\u0443\u0434\u0435 ${adj}${issue.maximum.toString()}`;
          }
          case "too_small": {
            const adj = issue.inclusive ? ">=" : ">";
            const sizing = getSizing(issue.origin);
            if (sizing) {
              return `\u0417\u0430\u043D\u0430\u0434\u0442\u043E \u043C\u0430\u043B\u0435: \u043E\u0447\u0456\u043A\u0443\u0454\u0442\u044C\u0441\u044F, \u0449\u043E ${issue.origin} ${sizing.verb} ${adj}${issue.minimum.toString()} ${sizing.unit}`;
            }
            return `\u0417\u0430\u043D\u0430\u0434\u0442\u043E \u043C\u0430\u043B\u0435: \u043E\u0447\u0456\u043A\u0443\u0454\u0442\u044C\u0441\u044F, \u0449\u043E ${issue.origin} \u0431\u0443\u0434\u0435 ${adj}${issue.minimum.toString()}`;
          }
          case "invalid_format": {
            const _issue = issue;
            if (_issue.format === "starts_with")
              return `\u041D\u0435\u043F\u0440\u0430\u0432\u0438\u043B\u044C\u043D\u0438\u0439 \u0440\u044F\u0434\u043E\u043A: \u043F\u043E\u0432\u0438\u043D\u0435\u043D \u043F\u043E\u0447\u0438\u043D\u0430\u0442\u0438\u0441\u044F \u0437 "${_issue.prefix}"`;
            if (_issue.format === "ends_with")
              return `\u041D\u0435\u043F\u0440\u0430\u0432\u0438\u043B\u044C\u043D\u0438\u0439 \u0440\u044F\u0434\u043E\u043A: \u043F\u043E\u0432\u0438\u043D\u0435\u043D \u0437\u0430\u043A\u0456\u043D\u0447\u0443\u0432\u0430\u0442\u0438\u0441\u044F \u043D\u0430 "${_issue.suffix}"`;
            if (_issue.format === "includes")
              return `\u041D\u0435\u043F\u0440\u0430\u0432\u0438\u043B\u044C\u043D\u0438\u0439 \u0440\u044F\u0434\u043E\u043A: \u043F\u043E\u0432\u0438\u043D\u0435\u043D \u043C\u0456\u0441\u0442\u0438\u0442\u0438 "${_issue.includes}"`;
            if (_issue.format === "regex")
              return `\u041D\u0435\u043F\u0440\u0430\u0432\u0438\u043B\u044C\u043D\u0438\u0439 \u0440\u044F\u0434\u043E\u043A: \u043F\u043E\u0432\u0438\u043D\u0435\u043D \u0432\u0456\u0434\u043F\u043E\u0432\u0456\u0434\u0430\u0442\u0438 \u0448\u0430\u0431\u043B\u043E\u043D\u0443 ${_issue.pattern}`;
            return `\u041D\u0435\u043F\u0440\u0430\u0432\u0438\u043B\u044C\u043D\u0438\u0439 ${FormatDictionary[_issue.format] ?? issue.format}`;
          }
          case "not_multiple_of":
            return `\u041D\u0435\u043F\u0440\u0430\u0432\u0438\u043B\u044C\u043D\u0435 \u0447\u0438\u0441\u043B\u043E: \u043F\u043E\u0432\u0438\u043D\u043D\u043E \u0431\u0443\u0442\u0438 \u043A\u0440\u0430\u0442\u043D\u0438\u043C ${issue.divisor}`;
          case "unrecognized_keys":
            return `\u041D\u0435\u0440\u043E\u0437\u043F\u0456\u0437\u043D\u0430\u043D\u0438\u0439 \u043A\u043B\u044E\u0447${issue.keys.length > 1 ? "\u0456" : ""}: ${util.joinValues(issue.keys, ", ")}`;
          case "invalid_key":
            return `\u041D\u0435\u043F\u0440\u0430\u0432\u0438\u043B\u044C\u043D\u0438\u0439 \u043A\u043B\u044E\u0447 \u0443 ${issue.origin}`;
          case "invalid_union":
            return "\u041D\u0435\u043F\u0440\u0430\u0432\u0438\u043B\u044C\u043D\u0456 \u0432\u0445\u0456\u0434\u043D\u0456 \u0434\u0430\u043D\u0456";
          case "invalid_element":
            return `\u041D\u0435\u043F\u0440\u0430\u0432\u0438\u043B\u044C\u043D\u0435 \u0437\u043D\u0430\u0447\u0435\u043D\u043D\u044F \u0443 ${issue.origin}`;
          default:
            return `\u041D\u0435\u043F\u0440\u0430\u0432\u0438\u043B\u044C\u043D\u0456 \u0432\u0445\u0456\u0434\u043D\u0456 \u0434\u0430\u043D\u0456`;
        }
      };
    }, "error");
    function default_1() {
      return {
        localeError: error()
      };
    }
    __name(default_1, "default_1");
    module2.exports = exports2.default;
  }
});

// node_modules/zod/v4/locales/ua.cjs
var require_ua = __commonJS({
  "node_modules/zod/v4/locales/ua.cjs"(exports2, module2) {
    "use strict";
    var __importDefault = exports2 && exports2.__importDefault || function(mod) {
      return mod && mod.__esModule ? mod : { "default": mod };
    };
    Object.defineProperty(exports2, "__esModule", { value: true });
    exports2.default = default_1;
    var uk_js_1 = __importDefault(require_uk());
    function default_1() {
      return (0, uk_js_1.default)();
    }
    __name(default_1, "default_1");
    module2.exports = exports2.default;
  }
});

// node_modules/zod/v4/locales/ur.cjs
var require_ur = __commonJS({
  "node_modules/zod/v4/locales/ur.cjs"(exports2, module2) {
    "use strict";
    var __createBinding = exports2 && exports2.__createBinding || (Object.create ? (function(o, m, k, k2) {
      if (k2 === void 0) k2 = k;
      var desc = Object.getOwnPropertyDescriptor(m, k);
      if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
        desc = { enumerable: true, get: /* @__PURE__ */ __name(function() {
          return m[k];
        }, "get") };
      }
      Object.defineProperty(o, k2, desc);
    }) : (function(o, m, k, k2) {
      if (k2 === void 0) k2 = k;
      o[k2] = m[k];
    }));
    var __setModuleDefault = exports2 && exports2.__setModuleDefault || (Object.create ? (function(o, v) {
      Object.defineProperty(o, "default", { enumerable: true, value: v });
    }) : function(o, v) {
      o["default"] = v;
    });
    var __importStar = exports2 && exports2.__importStar || function(mod) {
      if (mod && mod.__esModule) return mod;
      var result = {};
      if (mod != null) {
        for (var k in mod) if (k !== "default" && Object.prototype.hasOwnProperty.call(mod, k)) __createBinding(result, mod, k);
      }
      __setModuleDefault(result, mod);
      return result;
    };
    Object.defineProperty(exports2, "__esModule", { value: true });
    exports2.default = default_1;
    var util = __importStar(require_util());
    var error = /* @__PURE__ */ __name(() => {
      const Sizable = {
        string: { unit: "\u062D\u0631\u0648\u0641", verb: "\u06C1\u0648\u0646\u0627" },
        file: { unit: "\u0628\u0627\u0626\u0679\u0633", verb: "\u06C1\u0648\u0646\u0627" },
        array: { unit: "\u0622\u0626\u0679\u0645\u0632", verb: "\u06C1\u0648\u0646\u0627" },
        set: { unit: "\u0622\u0626\u0679\u0645\u0632", verb: "\u06C1\u0648\u0646\u0627" }
      };
      function getSizing(origin) {
        return Sizable[origin] ?? null;
      }
      __name(getSizing, "getSizing");
      const FormatDictionary = {
        regex: "\u0627\u0646 \u067E\u0679",
        email: "\u0627\u06CC \u0645\u06CC\u0644 \u0627\u06CC\u0688\u0631\u06CC\u0633",
        url: "\u06CC\u0648 \u0622\u0631 \u0627\u06CC\u0644",
        emoji: "\u0627\u06CC\u0645\u0648\u062C\u06CC",
        uuid: "\u06CC\u0648 \u06CC\u0648 \u0622\u0626\u06CC \u0688\u06CC",
        uuidv4: "\u06CC\u0648 \u06CC\u0648 \u0622\u0626\u06CC \u0688\u06CC \u0648\u06CC 4",
        uuidv6: "\u06CC\u0648 \u06CC\u0648 \u0622\u0626\u06CC \u0688\u06CC \u0648\u06CC 6",
        nanoid: "\u0646\u06CC\u0646\u0648 \u0622\u0626\u06CC \u0688\u06CC",
        guid: "\u062C\u06CC \u06CC\u0648 \u0622\u0626\u06CC \u0688\u06CC",
        cuid: "\u0633\u06CC \u06CC\u0648 \u0622\u0626\u06CC \u0688\u06CC",
        cuid2: "\u0633\u06CC \u06CC\u0648 \u0622\u0626\u06CC \u0688\u06CC 2",
        ulid: "\u06CC\u0648 \u0627\u06CC\u0644 \u0622\u0626\u06CC \u0688\u06CC",
        xid: "\u0627\u06CC\u06A9\u0633 \u0622\u0626\u06CC \u0688\u06CC",
        ksuid: "\u06A9\u06D2 \u0627\u06CC\u0633 \u06CC\u0648 \u0622\u0626\u06CC \u0688\u06CC",
        datetime: "\u0622\u0626\u06CC \u0627\u06CC\u0633 \u0627\u0648 \u0688\u06CC\u0679 \u0679\u0627\u0626\u0645",
        date: "\u0622\u0626\u06CC \u0627\u06CC\u0633 \u0627\u0648 \u062A\u0627\u0631\u06CC\u062E",
        time: "\u0622\u0626\u06CC \u0627\u06CC\u0633 \u0627\u0648 \u0648\u0642\u062A",
        duration: "\u0622\u0626\u06CC \u0627\u06CC\u0633 \u0627\u0648 \u0645\u062F\u062A",
        ipv4: "\u0622\u0626\u06CC \u067E\u06CC \u0648\u06CC 4 \u0627\u06CC\u0688\u0631\u06CC\u0633",
        ipv6: "\u0622\u0626\u06CC \u067E\u06CC \u0648\u06CC 6 \u0627\u06CC\u0688\u0631\u06CC\u0633",
        cidrv4: "\u0622\u0626\u06CC \u067E\u06CC \u0648\u06CC 4 \u0631\u06CC\u0646\u062C",
        cidrv6: "\u0622\u0626\u06CC \u067E\u06CC \u0648\u06CC 6 \u0631\u06CC\u0646\u062C",
        base64: "\u0628\u06CC\u0633 64 \u0627\u0646 \u06A9\u0648\u0688\u0688 \u0633\u0679\u0631\u0646\u06AF",
        base64url: "\u0628\u06CC\u0633 64 \u06CC\u0648 \u0622\u0631 \u0627\u06CC\u0644 \u0627\u0646 \u06A9\u0648\u0688\u0688 \u0633\u0679\u0631\u0646\u06AF",
        json_string: "\u062C\u06D2 \u0627\u06CC\u0633 \u0627\u0648 \u0627\u06CC\u0646 \u0633\u0679\u0631\u0646\u06AF",
        e164: "\u0627\u06CC 164 \u0646\u0645\u0628\u0631",
        jwt: "\u062C\u06D2 \u0688\u0628\u0644\u06CC\u0648 \u0679\u06CC",
        template_literal: "\u0627\u0646 \u067E\u0679"
      };
      const TypeDictionary = {
        nan: "NaN",
        number: "\u0646\u0645\u0628\u0631",
        array: "\u0622\u0631\u06D2",
        null: "\u0646\u0644"
      };
      return (issue) => {
        switch (issue.code) {
          case "invalid_type": {
            const expected = TypeDictionary[issue.expected] ?? issue.expected;
            const receivedType = util.parsedType(issue.input);
            const received = TypeDictionary[receivedType] ?? receivedType;
            if (/^[A-Z]/.test(issue.expected)) {
              return `\u063A\u0644\u0637 \u0627\u0646 \u067E\u0679: instanceof ${issue.expected} \u0645\u062A\u0648\u0642\u0639 \u062A\u06BE\u0627\u060C ${received} \u0645\u0648\u0635\u0648\u0644 \u06C1\u0648\u0627`;
            }
            return `\u063A\u0644\u0637 \u0627\u0646 \u067E\u0679: ${expected} \u0645\u062A\u0648\u0642\u0639 \u062A\u06BE\u0627\u060C ${received} \u0645\u0648\u0635\u0648\u0644 \u06C1\u0648\u0627`;
          }
          case "invalid_value":
            if (issue.values.length === 1)
              return `\u063A\u0644\u0637 \u0627\u0646 \u067E\u0679: ${util.stringifyPrimitive(issue.values[0])} \u0645\u062A\u0648\u0642\u0639 \u062A\u06BE\u0627`;
            return `\u063A\u0644\u0637 \u0622\u067E\u0634\u0646: ${util.joinValues(issue.values, "|")} \u0645\u06CC\u06BA \u0633\u06D2 \u0627\u06CC\u06A9 \u0645\u062A\u0648\u0642\u0639 \u062A\u06BE\u0627`;
          case "too_big": {
            const adj = issue.inclusive ? "<=" : "<";
            const sizing = getSizing(issue.origin);
            if (sizing)
              return `\u0628\u06C1\u062A \u0628\u0691\u0627: ${issue.origin ?? "\u0648\u06CC\u0644\u06CC\u0648"} \u06A9\u06D2 ${adj}${issue.maximum.toString()} ${sizing.unit ?? "\u0639\u0646\u0627\u0635\u0631"} \u06C1\u0648\u0646\u06D2 \u0645\u062A\u0648\u0642\u0639 \u062A\u06BE\u06D2`;
            return `\u0628\u06C1\u062A \u0628\u0691\u0627: ${issue.origin ?? "\u0648\u06CC\u0644\u06CC\u0648"} \u06A9\u0627 ${adj}${issue.maximum.toString()} \u06C1\u0648\u0646\u0627 \u0645\u062A\u0648\u0642\u0639 \u062A\u06BE\u0627`;
          }
          case "too_small": {
            const adj = issue.inclusive ? ">=" : ">";
            const sizing = getSizing(issue.origin);
            if (sizing) {
              return `\u0628\u06C1\u062A \u0686\u06BE\u0648\u0679\u0627: ${issue.origin} \u06A9\u06D2 ${adj}${issue.minimum.toString()} ${sizing.unit} \u06C1\u0648\u0646\u06D2 \u0645\u062A\u0648\u0642\u0639 \u062A\u06BE\u06D2`;
            }
            return `\u0628\u06C1\u062A \u0686\u06BE\u0648\u0679\u0627: ${issue.origin} \u06A9\u0627 ${adj}${issue.minimum.toString()} \u06C1\u0648\u0646\u0627 \u0645\u062A\u0648\u0642\u0639 \u062A\u06BE\u0627`;
          }
          case "invalid_format": {
            const _issue = issue;
            if (_issue.format === "starts_with") {
              return `\u063A\u0644\u0637 \u0633\u0679\u0631\u0646\u06AF: "${_issue.prefix}" \u0633\u06D2 \u0634\u0631\u0648\u0639 \u06C1\u0648\u0646\u0627 \u0686\u0627\u06C1\u06CC\u06D2`;
            }
            if (_issue.format === "ends_with")
              return `\u063A\u0644\u0637 \u0633\u0679\u0631\u0646\u06AF: "${_issue.suffix}" \u067E\u0631 \u062E\u062A\u0645 \u06C1\u0648\u0646\u0627 \u0686\u0627\u06C1\u06CC\u06D2`;
            if (_issue.format === "includes")
              return `\u063A\u0644\u0637 \u0633\u0679\u0631\u0646\u06AF: "${_issue.includes}" \u0634\u0627\u0645\u0644 \u06C1\u0648\u0646\u0627 \u0686\u0627\u06C1\u06CC\u06D2`;
            if (_issue.format === "regex")
              return `\u063A\u0644\u0637 \u0633\u0679\u0631\u0646\u06AF: \u067E\u06CC\u0679\u0631\u0646 ${_issue.pattern} \u0633\u06D2 \u0645\u06CC\u0686 \u06C1\u0648\u0646\u0627 \u0686\u0627\u06C1\u06CC\u06D2`;
            return `\u063A\u0644\u0637 ${FormatDictionary[_issue.format] ?? issue.format}`;
          }
          case "not_multiple_of":
            return `\u063A\u0644\u0637 \u0646\u0645\u0628\u0631: ${issue.divisor} \u06A9\u0627 \u0645\u0636\u0627\u0639\u0641 \u06C1\u0648\u0646\u0627 \u0686\u0627\u06C1\u06CC\u06D2`;
          case "unrecognized_keys":
            return `\u063A\u06CC\u0631 \u062A\u0633\u0644\u06CC\u0645 \u0634\u062F\u06C1 \u06A9\u06CC${issue.keys.length > 1 ? "\u0632" : ""}: ${util.joinValues(issue.keys, "\u060C ")}`;
          case "invalid_key":
            return `${issue.origin} \u0645\u06CC\u06BA \u063A\u0644\u0637 \u06A9\u06CC`;
          case "invalid_union":
            return "\u063A\u0644\u0637 \u0627\u0646 \u067E\u0679";
          case "invalid_element":
            return `${issue.origin} \u0645\u06CC\u06BA \u063A\u0644\u0637 \u0648\u06CC\u0644\u06CC\u0648`;
          default:
            return `\u063A\u0644\u0637 \u0627\u0646 \u067E\u0679`;
        }
      };
    }, "error");
    function default_1() {
      return {
        localeError: error()
      };
    }
    __name(default_1, "default_1");
    module2.exports = exports2.default;
  }
});

// node_modules/zod/v4/locales/uz.cjs
var require_uz = __commonJS({
  "node_modules/zod/v4/locales/uz.cjs"(exports2, module2) {
    "use strict";
    var __createBinding = exports2 && exports2.__createBinding || (Object.create ? (function(o, m, k, k2) {
      if (k2 === void 0) k2 = k;
      var desc = Object.getOwnPropertyDescriptor(m, k);
      if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
        desc = { enumerable: true, get: /* @__PURE__ */ __name(function() {
          return m[k];
        }, "get") };
      }
      Object.defineProperty(o, k2, desc);
    }) : (function(o, m, k, k2) {
      if (k2 === void 0) k2 = k;
      o[k2] = m[k];
    }));
    var __setModuleDefault = exports2 && exports2.__setModuleDefault || (Object.create ? (function(o, v) {
      Object.defineProperty(o, "default", { enumerable: true, value: v });
    }) : function(o, v) {
      o["default"] = v;
    });
    var __importStar = exports2 && exports2.__importStar || function(mod) {
      if (mod && mod.__esModule) return mod;
      var result = {};
      if (mod != null) {
        for (var k in mod) if (k !== "default" && Object.prototype.hasOwnProperty.call(mod, k)) __createBinding(result, mod, k);
      }
      __setModuleDefault(result, mod);
      return result;
    };
    Object.defineProperty(exports2, "__esModule", { value: true });
    exports2.default = default_1;
    var util = __importStar(require_util());
    var error = /* @__PURE__ */ __name(() => {
      const Sizable = {
        string: { unit: "belgi", verb: "bo\u2018lishi kerak" },
        file: { unit: "bayt", verb: "bo\u2018lishi kerak" },
        array: { unit: "element", verb: "bo\u2018lishi kerak" },
        set: { unit: "element", verb: "bo\u2018lishi kerak" }
      };
      function getSizing(origin) {
        return Sizable[origin] ?? null;
      }
      __name(getSizing, "getSizing");
      const FormatDictionary = {
        regex: "kirish",
        email: "elektron pochta manzili",
        url: "URL",
        emoji: "emoji",
        uuid: "UUID",
        uuidv4: "UUIDv4",
        uuidv6: "UUIDv6",
        nanoid: "nanoid",
        guid: "GUID",
        cuid: "cuid",
        cuid2: "cuid2",
        ulid: "ULID",
        xid: "XID",
        ksuid: "KSUID",
        datetime: "ISO sana va vaqti",
        date: "ISO sana",
        time: "ISO vaqt",
        duration: "ISO davomiylik",
        ipv4: "IPv4 manzil",
        ipv6: "IPv6 manzil",
        mac: "MAC manzil",
        cidrv4: "IPv4 diapazon",
        cidrv6: "IPv6 diapazon",
        base64: "base64 kodlangan satr",
        base64url: "base64url kodlangan satr",
        json_string: "JSON satr",
        e164: "E.164 raqam",
        jwt: "JWT",
        template_literal: "kirish"
      };
      const TypeDictionary = {
        nan: "NaN",
        number: "raqam",
        array: "massiv"
      };
      return (issue) => {
        switch (issue.code) {
          case "invalid_type": {
            const expected = TypeDictionary[issue.expected] ?? issue.expected;
            const receivedType = util.parsedType(issue.input);
            const received = TypeDictionary[receivedType] ?? receivedType;
            if (/^[A-Z]/.test(issue.expected)) {
              return `Noto\u2018g\u2018ri kirish: kutilgan instanceof ${issue.expected}, qabul qilingan ${received}`;
            }
            return `Noto\u2018g\u2018ri kirish: kutilgan ${expected}, qabul qilingan ${received}`;
          }
          case "invalid_value":
            if (issue.values.length === 1)
              return `Noto\u2018g\u2018ri kirish: kutilgan ${util.stringifyPrimitive(issue.values[0])}`;
            return `Noto\u2018g\u2018ri variant: quyidagilardan biri kutilgan ${util.joinValues(issue.values, "|")}`;
          case "too_big": {
            const adj = issue.inclusive ? "<=" : "<";
            const sizing = getSizing(issue.origin);
            if (sizing)
              return `Juda katta: kutilgan ${issue.origin ?? "qiymat"} ${adj}${issue.maximum.toString()} ${sizing.unit} ${sizing.verb}`;
            return `Juda katta: kutilgan ${issue.origin ?? "qiymat"} ${adj}${issue.maximum.toString()}`;
          }
          case "too_small": {
            const adj = issue.inclusive ? ">=" : ">";
            const sizing = getSizing(issue.origin);
            if (sizing) {
              return `Juda kichik: kutilgan ${issue.origin} ${adj}${issue.minimum.toString()} ${sizing.unit} ${sizing.verb}`;
            }
            return `Juda kichik: kutilgan ${issue.origin} ${adj}${issue.minimum.toString()}`;
          }
          case "invalid_format": {
            const _issue = issue;
            if (_issue.format === "starts_with")
              return `Noto\u2018g\u2018ri satr: "${_issue.prefix}" bilan boshlanishi kerak`;
            if (_issue.format === "ends_with")
              return `Noto\u2018g\u2018ri satr: "${_issue.suffix}" bilan tugashi kerak`;
            if (_issue.format === "includes")
              return `Noto\u2018g\u2018ri satr: "${_issue.includes}" ni o\u2018z ichiga olishi kerak`;
            if (_issue.format === "regex")
              return `Noto\u2018g\u2018ri satr: ${_issue.pattern} shabloniga mos kelishi kerak`;
            return `Noto\u2018g\u2018ri ${FormatDictionary[_issue.format] ?? issue.format}`;
          }
          case "not_multiple_of":
            return `Noto\u2018g\u2018ri raqam: ${issue.divisor} ning karralisi bo\u2018lishi kerak`;
          case "unrecognized_keys":
            return `Noma\u2019lum kalit${issue.keys.length > 1 ? "lar" : ""}: ${util.joinValues(issue.keys, ", ")}`;
          case "invalid_key":
            return `${issue.origin} dagi kalit noto\u2018g\u2018ri`;
          case "invalid_union":
            return "Noto\u2018g\u2018ri kirish";
          case "invalid_element":
            return `${issue.origin} da noto\u2018g\u2018ri qiymat`;
          default:
            return `Noto\u2018g\u2018ri kirish`;
        }
      };
    }, "error");
    function default_1() {
      return {
        localeError: error()
      };
    }
    __name(default_1, "default_1");
    module2.exports = exports2.default;
  }
});

// node_modules/zod/v4/locales/vi.cjs
var require_vi = __commonJS({
  "node_modules/zod/v4/locales/vi.cjs"(exports2, module2) {
    "use strict";
    var __createBinding = exports2 && exports2.__createBinding || (Object.create ? (function(o, m, k, k2) {
      if (k2 === void 0) k2 = k;
      var desc = Object.getOwnPropertyDescriptor(m, k);
      if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
        desc = { enumerable: true, get: /* @__PURE__ */ __name(function() {
          return m[k];
        }, "get") };
      }
      Object.defineProperty(o, k2, desc);
    }) : (function(o, m, k, k2) {
      if (k2 === void 0) k2 = k;
      o[k2] = m[k];
    }));
    var __setModuleDefault = exports2 && exports2.__setModuleDefault || (Object.create ? (function(o, v) {
      Object.defineProperty(o, "default", { enumerable: true, value: v });
    }) : function(o, v) {
      o["default"] = v;
    });
    var __importStar = exports2 && exports2.__importStar || function(mod) {
      if (mod && mod.__esModule) return mod;
      var result = {};
      if (mod != null) {
        for (var k in mod) if (k !== "default" && Object.prototype.hasOwnProperty.call(mod, k)) __createBinding(result, mod, k);
      }
      __setModuleDefault(result, mod);
      return result;
    };
    Object.defineProperty(exports2, "__esModule", { value: true });
    exports2.default = default_1;
    var util = __importStar(require_util());
    var error = /* @__PURE__ */ __name(() => {
      const Sizable = {
        string: { unit: "k\xFD t\u1EF1", verb: "c\xF3" },
        file: { unit: "byte", verb: "c\xF3" },
        array: { unit: "ph\u1EA7n t\u1EED", verb: "c\xF3" },
        set: { unit: "ph\u1EA7n t\u1EED", verb: "c\xF3" }
      };
      function getSizing(origin) {
        return Sizable[origin] ?? null;
      }
      __name(getSizing, "getSizing");
      const FormatDictionary = {
        regex: "\u0111\u1EA7u v\xE0o",
        email: "\u0111\u1ECBa ch\u1EC9 email",
        url: "URL",
        emoji: "emoji",
        uuid: "UUID",
        uuidv4: "UUIDv4",
        uuidv6: "UUIDv6",
        nanoid: "nanoid",
        guid: "GUID",
        cuid: "cuid",
        cuid2: "cuid2",
        ulid: "ULID",
        xid: "XID",
        ksuid: "KSUID",
        datetime: "ng\xE0y gi\u1EDD ISO",
        date: "ng\xE0y ISO",
        time: "gi\u1EDD ISO",
        duration: "kho\u1EA3ng th\u1EDDi gian ISO",
        ipv4: "\u0111\u1ECBa ch\u1EC9 IPv4",
        ipv6: "\u0111\u1ECBa ch\u1EC9 IPv6",
        cidrv4: "d\u1EA3i IPv4",
        cidrv6: "d\u1EA3i IPv6",
        base64: "chu\u1ED7i m\xE3 h\xF3a base64",
        base64url: "chu\u1ED7i m\xE3 h\xF3a base64url",
        json_string: "chu\u1ED7i JSON",
        e164: "s\u1ED1 E.164",
        jwt: "JWT",
        template_literal: "\u0111\u1EA7u v\xE0o"
      };
      const TypeDictionary = {
        nan: "NaN",
        number: "s\u1ED1",
        array: "m\u1EA3ng"
      };
      return (issue) => {
        switch (issue.code) {
          case "invalid_type": {
            const expected = TypeDictionary[issue.expected] ?? issue.expected;
            const receivedType = util.parsedType(issue.input);
            const received = TypeDictionary[receivedType] ?? receivedType;
            if (/^[A-Z]/.test(issue.expected)) {
              return `\u0110\u1EA7u v\xE0o kh\xF4ng h\u1EE3p l\u1EC7: mong \u0111\u1EE3i instanceof ${issue.expected}, nh\u1EADn \u0111\u01B0\u1EE3c ${received}`;
            }
            return `\u0110\u1EA7u v\xE0o kh\xF4ng h\u1EE3p l\u1EC7: mong \u0111\u1EE3i ${expected}, nh\u1EADn \u0111\u01B0\u1EE3c ${received}`;
          }
          case "invalid_value":
            if (issue.values.length === 1)
              return `\u0110\u1EA7u v\xE0o kh\xF4ng h\u1EE3p l\u1EC7: mong \u0111\u1EE3i ${util.stringifyPrimitive(issue.values[0])}`;
            return `T\xF9y ch\u1ECDn kh\xF4ng h\u1EE3p l\u1EC7: mong \u0111\u1EE3i m\u1ED9t trong c\xE1c gi\xE1 tr\u1ECB ${util.joinValues(issue.values, "|")}`;
          case "too_big": {
            const adj = issue.inclusive ? "<=" : "<";
            const sizing = getSizing(issue.origin);
            if (sizing)
              return `Qu\xE1 l\u1EDBn: mong \u0111\u1EE3i ${issue.origin ?? "gi\xE1 tr\u1ECB"} ${sizing.verb} ${adj}${issue.maximum.toString()} ${sizing.unit ?? "ph\u1EA7n t\u1EED"}`;
            return `Qu\xE1 l\u1EDBn: mong \u0111\u1EE3i ${issue.origin ?? "gi\xE1 tr\u1ECB"} ${adj}${issue.maximum.toString()}`;
          }
          case "too_small": {
            const adj = issue.inclusive ? ">=" : ">";
            const sizing = getSizing(issue.origin);
            if (sizing) {
              return `Qu\xE1 nh\u1ECF: mong \u0111\u1EE3i ${issue.origin} ${sizing.verb} ${adj}${issue.minimum.toString()} ${sizing.unit}`;
            }
            return `Qu\xE1 nh\u1ECF: mong \u0111\u1EE3i ${issue.origin} ${adj}${issue.minimum.toString()}`;
          }
          case "invalid_format": {
            const _issue = issue;
            if (_issue.format === "starts_with")
              return `Chu\u1ED7i kh\xF4ng h\u1EE3p l\u1EC7: ph\u1EA3i b\u1EAFt \u0111\u1EA7u b\u1EB1ng "${_issue.prefix}"`;
            if (_issue.format === "ends_with")
              return `Chu\u1ED7i kh\xF4ng h\u1EE3p l\u1EC7: ph\u1EA3i k\u1EBFt th\xFAc b\u1EB1ng "${_issue.suffix}"`;
            if (_issue.format === "includes")
              return `Chu\u1ED7i kh\xF4ng h\u1EE3p l\u1EC7: ph\u1EA3i bao g\u1ED3m "${_issue.includes}"`;
            if (_issue.format === "regex")
              return `Chu\u1ED7i kh\xF4ng h\u1EE3p l\u1EC7: ph\u1EA3i kh\u1EDBp v\u1EDBi m\u1EABu ${_issue.pattern}`;
            return `${FormatDictionary[_issue.format] ?? issue.format} kh\xF4ng h\u1EE3p l\u1EC7`;
          }
          case "not_multiple_of":
            return `S\u1ED1 kh\xF4ng h\u1EE3p l\u1EC7: ph\u1EA3i l\xE0 b\u1ED9i s\u1ED1 c\u1EE7a ${issue.divisor}`;
          case "unrecognized_keys":
            return `Kh\xF3a kh\xF4ng \u0111\u01B0\u1EE3c nh\u1EADn d\u1EA1ng: ${util.joinValues(issue.keys, ", ")}`;
          case "invalid_key":
            return `Kh\xF3a kh\xF4ng h\u1EE3p l\u1EC7 trong ${issue.origin}`;
          case "invalid_union":
            return "\u0110\u1EA7u v\xE0o kh\xF4ng h\u1EE3p l\u1EC7";
          case "invalid_element":
            return `Gi\xE1 tr\u1ECB kh\xF4ng h\u1EE3p l\u1EC7 trong ${issue.origin}`;
          default:
            return `\u0110\u1EA7u v\xE0o kh\xF4ng h\u1EE3p l\u1EC7`;
        }
      };
    }, "error");
    function default_1() {
      return {
        localeError: error()
      };
    }
    __name(default_1, "default_1");
    module2.exports = exports2.default;
  }
});

// node_modules/zod/v4/locales/zh-CN.cjs
var require_zh_CN = __commonJS({
  "node_modules/zod/v4/locales/zh-CN.cjs"(exports2, module2) {
    "use strict";
    var __createBinding = exports2 && exports2.__createBinding || (Object.create ? (function(o, m, k, k2) {
      if (k2 === void 0) k2 = k;
      var desc = Object.getOwnPropertyDescriptor(m, k);
      if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
        desc = { enumerable: true, get: /* @__PURE__ */ __name(function() {
          return m[k];
        }, "get") };
      }
      Object.defineProperty(o, k2, desc);
    }) : (function(o, m, k, k2) {
      if (k2 === void 0) k2 = k;
      o[k2] = m[k];
    }));
    var __setModuleDefault = exports2 && exports2.__setModuleDefault || (Object.create ? (function(o, v) {
      Object.defineProperty(o, "default", { enumerable: true, value: v });
    }) : function(o, v) {
      o["default"] = v;
    });
    var __importStar = exports2 && exports2.__importStar || function(mod) {
      if (mod && mod.__esModule) return mod;
      var result = {};
      if (mod != null) {
        for (var k in mod) if (k !== "default" && Object.prototype.hasOwnProperty.call(mod, k)) __createBinding(result, mod, k);
      }
      __setModuleDefault(result, mod);
      return result;
    };
    Object.defineProperty(exports2, "__esModule", { value: true });
    exports2.default = default_1;
    var util = __importStar(require_util());
    var error = /* @__PURE__ */ __name(() => {
      const Sizable = {
        string: { unit: "\u5B57\u7B26", verb: "\u5305\u542B" },
        file: { unit: "\u5B57\u8282", verb: "\u5305\u542B" },
        array: { unit: "\u9879", verb: "\u5305\u542B" },
        set: { unit: "\u9879", verb: "\u5305\u542B" }
      };
      function getSizing(origin) {
        return Sizable[origin] ?? null;
      }
      __name(getSizing, "getSizing");
      const FormatDictionary = {
        regex: "\u8F93\u5165",
        email: "\u7535\u5B50\u90AE\u4EF6",
        url: "URL",
        emoji: "\u8868\u60C5\u7B26\u53F7",
        uuid: "UUID",
        uuidv4: "UUIDv4",
        uuidv6: "UUIDv6",
        nanoid: "nanoid",
        guid: "GUID",
        cuid: "cuid",
        cuid2: "cuid2",
        ulid: "ULID",
        xid: "XID",
        ksuid: "KSUID",
        datetime: "ISO\u65E5\u671F\u65F6\u95F4",
        date: "ISO\u65E5\u671F",
        time: "ISO\u65F6\u95F4",
        duration: "ISO\u65F6\u957F",
        ipv4: "IPv4\u5730\u5740",
        ipv6: "IPv6\u5730\u5740",
        cidrv4: "IPv4\u7F51\u6BB5",
        cidrv6: "IPv6\u7F51\u6BB5",
        base64: "base64\u7F16\u7801\u5B57\u7B26\u4E32",
        base64url: "base64url\u7F16\u7801\u5B57\u7B26\u4E32",
        json_string: "JSON\u5B57\u7B26\u4E32",
        e164: "E.164\u53F7\u7801",
        jwt: "JWT",
        template_literal: "\u8F93\u5165"
      };
      const TypeDictionary = {
        nan: "NaN",
        number: "\u6570\u5B57",
        array: "\u6570\u7EC4",
        null: "\u7A7A\u503C(null)"
      };
      return (issue) => {
        switch (issue.code) {
          case "invalid_type": {
            const expected = TypeDictionary[issue.expected] ?? issue.expected;
            const receivedType = util.parsedType(issue.input);
            const received = TypeDictionary[receivedType] ?? receivedType;
            if (/^[A-Z]/.test(issue.expected)) {
              return `\u65E0\u6548\u8F93\u5165\uFF1A\u671F\u671B instanceof ${issue.expected}\uFF0C\u5B9E\u9645\u63A5\u6536 ${received}`;
            }
            return `\u65E0\u6548\u8F93\u5165\uFF1A\u671F\u671B ${expected}\uFF0C\u5B9E\u9645\u63A5\u6536 ${received}`;
          }
          case "invalid_value":
            if (issue.values.length === 1)
              return `\u65E0\u6548\u8F93\u5165\uFF1A\u671F\u671B ${util.stringifyPrimitive(issue.values[0])}`;
            return `\u65E0\u6548\u9009\u9879\uFF1A\u671F\u671B\u4EE5\u4E0B\u4E4B\u4E00 ${util.joinValues(issue.values, "|")}`;
          case "too_big": {
            const adj = issue.inclusive ? "<=" : "<";
            const sizing = getSizing(issue.origin);
            if (sizing)
              return `\u6570\u503C\u8FC7\u5927\uFF1A\u671F\u671B ${issue.origin ?? "\u503C"} ${adj}${issue.maximum.toString()} ${sizing.unit ?? "\u4E2A\u5143\u7D20"}`;
            return `\u6570\u503C\u8FC7\u5927\uFF1A\u671F\u671B ${issue.origin ?? "\u503C"} ${adj}${issue.maximum.toString()}`;
          }
          case "too_small": {
            const adj = issue.inclusive ? ">=" : ">";
            const sizing = getSizing(issue.origin);
            if (sizing) {
              return `\u6570\u503C\u8FC7\u5C0F\uFF1A\u671F\u671B ${issue.origin} ${adj}${issue.minimum.toString()} ${sizing.unit}`;
            }
            return `\u6570\u503C\u8FC7\u5C0F\uFF1A\u671F\u671B ${issue.origin} ${adj}${issue.minimum.toString()}`;
          }
          case "invalid_format": {
            const _issue = issue;
            if (_issue.format === "starts_with")
              return `\u65E0\u6548\u5B57\u7B26\u4E32\uFF1A\u5FC5\u987B\u4EE5 "${_issue.prefix}" \u5F00\u5934`;
            if (_issue.format === "ends_with")
              return `\u65E0\u6548\u5B57\u7B26\u4E32\uFF1A\u5FC5\u987B\u4EE5 "${_issue.suffix}" \u7ED3\u5C3E`;
            if (_issue.format === "includes")
              return `\u65E0\u6548\u5B57\u7B26\u4E32\uFF1A\u5FC5\u987B\u5305\u542B "${_issue.includes}"`;
            if (_issue.format === "regex")
              return `\u65E0\u6548\u5B57\u7B26\u4E32\uFF1A\u5FC5\u987B\u6EE1\u8DB3\u6B63\u5219\u8868\u8FBE\u5F0F ${_issue.pattern}`;
            return `\u65E0\u6548${FormatDictionary[_issue.format] ?? issue.format}`;
          }
          case "not_multiple_of":
            return `\u65E0\u6548\u6570\u5B57\uFF1A\u5FC5\u987B\u662F ${issue.divisor} \u7684\u500D\u6570`;
          case "unrecognized_keys":
            return `\u51FA\u73B0\u672A\u77E5\u7684\u952E(key): ${util.joinValues(issue.keys, ", ")}`;
          case "invalid_key":
            return `${issue.origin} \u4E2D\u7684\u952E(key)\u65E0\u6548`;
          case "invalid_union":
            return "\u65E0\u6548\u8F93\u5165";
          case "invalid_element":
            return `${issue.origin} \u4E2D\u5305\u542B\u65E0\u6548\u503C(value)`;
          default:
            return `\u65E0\u6548\u8F93\u5165`;
        }
      };
    }, "error");
    function default_1() {
      return {
        localeError: error()
      };
    }
    __name(default_1, "default_1");
    module2.exports = exports2.default;
  }
});

// node_modules/zod/v4/locales/zh-TW.cjs
var require_zh_TW = __commonJS({
  "node_modules/zod/v4/locales/zh-TW.cjs"(exports2, module2) {
    "use strict";
    var __createBinding = exports2 && exports2.__createBinding || (Object.create ? (function(o, m, k, k2) {
      if (k2 === void 0) k2 = k;
      var desc = Object.getOwnPropertyDescriptor(m, k);
      if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
        desc = { enumerable: true, get: /* @__PURE__ */ __name(function() {
          return m[k];
        }, "get") };
      }
      Object.defineProperty(o, k2, desc);
    }) : (function(o, m, k, k2) {
      if (k2 === void 0) k2 = k;
      o[k2] = m[k];
    }));
    var __setModuleDefault = exports2 && exports2.__setModuleDefault || (Object.create ? (function(o, v) {
      Object.defineProperty(o, "default", { enumerable: true, value: v });
    }) : function(o, v) {
      o["default"] = v;
    });
    var __importStar = exports2 && exports2.__importStar || function(mod) {
      if (mod && mod.__esModule) return mod;
      var result = {};
      if (mod != null) {
        for (var k in mod) if (k !== "default" && Object.prototype.hasOwnProperty.call(mod, k)) __createBinding(result, mod, k);
      }
      __setModuleDefault(result, mod);
      return result;
    };
    Object.defineProperty(exports2, "__esModule", { value: true });
    exports2.default = default_1;
    var util = __importStar(require_util());
    var error = /* @__PURE__ */ __name(() => {
      const Sizable = {
        string: { unit: "\u5B57\u5143", verb: "\u64C1\u6709" },
        file: { unit: "\u4F4D\u5143\u7D44", verb: "\u64C1\u6709" },
        array: { unit: "\u9805\u76EE", verb: "\u64C1\u6709" },
        set: { unit: "\u9805\u76EE", verb: "\u64C1\u6709" }
      };
      function getSizing(origin) {
        return Sizable[origin] ?? null;
      }
      __name(getSizing, "getSizing");
      const FormatDictionary = {
        regex: "\u8F38\u5165",
        email: "\u90F5\u4EF6\u5730\u5740",
        url: "URL",
        emoji: "emoji",
        uuid: "UUID",
        uuidv4: "UUIDv4",
        uuidv6: "UUIDv6",
        nanoid: "nanoid",
        guid: "GUID",
        cuid: "cuid",
        cuid2: "cuid2",
        ulid: "ULID",
        xid: "XID",
        ksuid: "KSUID",
        datetime: "ISO \u65E5\u671F\u6642\u9593",
        date: "ISO \u65E5\u671F",
        time: "ISO \u6642\u9593",
        duration: "ISO \u671F\u9593",
        ipv4: "IPv4 \u4F4D\u5740",
        ipv6: "IPv6 \u4F4D\u5740",
        cidrv4: "IPv4 \u7BC4\u570D",
        cidrv6: "IPv6 \u7BC4\u570D",
        base64: "base64 \u7DE8\u78BC\u5B57\u4E32",
        base64url: "base64url \u7DE8\u78BC\u5B57\u4E32",
        json_string: "JSON \u5B57\u4E32",
        e164: "E.164 \u6578\u503C",
        jwt: "JWT",
        template_literal: "\u8F38\u5165"
      };
      const TypeDictionary = {
        nan: "NaN"
      };
      return (issue) => {
        switch (issue.code) {
          case "invalid_type": {
            const expected = TypeDictionary[issue.expected] ?? issue.expected;
            const receivedType = util.parsedType(issue.input);
            const received = TypeDictionary[receivedType] ?? receivedType;
            if (/^[A-Z]/.test(issue.expected)) {
              return `\u7121\u6548\u7684\u8F38\u5165\u503C\uFF1A\u9810\u671F\u70BA instanceof ${issue.expected}\uFF0C\u4F46\u6536\u5230 ${received}`;
            }
            return `\u7121\u6548\u7684\u8F38\u5165\u503C\uFF1A\u9810\u671F\u70BA ${expected}\uFF0C\u4F46\u6536\u5230 ${received}`;
          }
          case "invalid_value":
            if (issue.values.length === 1)
              return `\u7121\u6548\u7684\u8F38\u5165\u503C\uFF1A\u9810\u671F\u70BA ${util.stringifyPrimitive(issue.values[0])}`;
            return `\u7121\u6548\u7684\u9078\u9805\uFF1A\u9810\u671F\u70BA\u4EE5\u4E0B\u5176\u4E2D\u4E4B\u4E00 ${util.joinValues(issue.values, "|")}`;
          case "too_big": {
            const adj = issue.inclusive ? "<=" : "<";
            const sizing = getSizing(issue.origin);
            if (sizing)
              return `\u6578\u503C\u904E\u5927\uFF1A\u9810\u671F ${issue.origin ?? "\u503C"} \u61C9\u70BA ${adj}${issue.maximum.toString()} ${sizing.unit ?? "\u500B\u5143\u7D20"}`;
            return `\u6578\u503C\u904E\u5927\uFF1A\u9810\u671F ${issue.origin ?? "\u503C"} \u61C9\u70BA ${adj}${issue.maximum.toString()}`;
          }
          case "too_small": {
            const adj = issue.inclusive ? ">=" : ">";
            const sizing = getSizing(issue.origin);
            if (sizing) {
              return `\u6578\u503C\u904E\u5C0F\uFF1A\u9810\u671F ${issue.origin} \u61C9\u70BA ${adj}${issue.minimum.toString()} ${sizing.unit}`;
            }
            return `\u6578\u503C\u904E\u5C0F\uFF1A\u9810\u671F ${issue.origin} \u61C9\u70BA ${adj}${issue.minimum.toString()}`;
          }
          case "invalid_format": {
            const _issue = issue;
            if (_issue.format === "starts_with") {
              return `\u7121\u6548\u7684\u5B57\u4E32\uFF1A\u5FC5\u9808\u4EE5 "${_issue.prefix}" \u958B\u982D`;
            }
            if (_issue.format === "ends_with")
              return `\u7121\u6548\u7684\u5B57\u4E32\uFF1A\u5FC5\u9808\u4EE5 "${_issue.suffix}" \u7D50\u5C3E`;
            if (_issue.format === "includes")
              return `\u7121\u6548\u7684\u5B57\u4E32\uFF1A\u5FC5\u9808\u5305\u542B "${_issue.includes}"`;
            if (_issue.format === "regex")
              return `\u7121\u6548\u7684\u5B57\u4E32\uFF1A\u5FC5\u9808\u7B26\u5408\u683C\u5F0F ${_issue.pattern}`;
            return `\u7121\u6548\u7684 ${FormatDictionary[_issue.format] ?? issue.format}`;
          }
          case "not_multiple_of":
            return `\u7121\u6548\u7684\u6578\u5B57\uFF1A\u5FC5\u9808\u70BA ${issue.divisor} \u7684\u500D\u6578`;
          case "unrecognized_keys":
            return `\u7121\u6CD5\u8B58\u5225\u7684\u9375\u503C${issue.keys.length > 1 ? "\u5011" : ""}\uFF1A${util.joinValues(issue.keys, "\u3001")}`;
          case "invalid_key":
            return `${issue.origin} \u4E2D\u6709\u7121\u6548\u7684\u9375\u503C`;
          case "invalid_union":
            return "\u7121\u6548\u7684\u8F38\u5165\u503C";
          case "invalid_element":
            return `${issue.origin} \u4E2D\u6709\u7121\u6548\u7684\u503C`;
          default:
            return `\u7121\u6548\u7684\u8F38\u5165\u503C`;
        }
      };
    }, "error");
    function default_1() {
      return {
        localeError: error()
      };
    }
    __name(default_1, "default_1");
    module2.exports = exports2.default;
  }
});

// node_modules/zod/v4/locales/yo.cjs
var require_yo = __commonJS({
  "node_modules/zod/v4/locales/yo.cjs"(exports2, module2) {
    "use strict";
    var __createBinding = exports2 && exports2.__createBinding || (Object.create ? (function(o, m, k, k2) {
      if (k2 === void 0) k2 = k;
      var desc = Object.getOwnPropertyDescriptor(m, k);
      if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
        desc = { enumerable: true, get: /* @__PURE__ */ __name(function() {
          return m[k];
        }, "get") };
      }
      Object.defineProperty(o, k2, desc);
    }) : (function(o, m, k, k2) {
      if (k2 === void 0) k2 = k;
      o[k2] = m[k];
    }));
    var __setModuleDefault = exports2 && exports2.__setModuleDefault || (Object.create ? (function(o, v) {
      Object.defineProperty(o, "default", { enumerable: true, value: v });
    }) : function(o, v) {
      o["default"] = v;
    });
    var __importStar = exports2 && exports2.__importStar || function(mod) {
      if (mod && mod.__esModule) return mod;
      var result = {};
      if (mod != null) {
        for (var k in mod) if (k !== "default" && Object.prototype.hasOwnProperty.call(mod, k)) __createBinding(result, mod, k);
      }
      __setModuleDefault(result, mod);
      return result;
    };
    Object.defineProperty(exports2, "__esModule", { value: true });
    exports2.default = default_1;
    var util = __importStar(require_util());
    var error = /* @__PURE__ */ __name(() => {
      const Sizable = {
        string: { unit: "\xE0mi", verb: "n\xED" },
        file: { unit: "bytes", verb: "n\xED" },
        array: { unit: "nkan", verb: "n\xED" },
        set: { unit: "nkan", verb: "n\xED" }
      };
      function getSizing(origin) {
        return Sizable[origin] ?? null;
      }
      __name(getSizing, "getSizing");
      const FormatDictionary = {
        regex: "\u1EB9\u0300r\u1ECD \xECb\xE1w\u1ECDl\xE9",
        email: "\xE0d\xEDr\u1EB9\u0301s\xEC \xECm\u1EB9\u0301l\xEC",
        url: "URL",
        emoji: "emoji",
        uuid: "UUID",
        uuidv4: "UUIDv4",
        uuidv6: "UUIDv6",
        nanoid: "nanoid",
        guid: "GUID",
        cuid: "cuid",
        cuid2: "cuid2",
        ulid: "ULID",
        xid: "XID",
        ksuid: "KSUID",
        datetime: "\xE0k\xF3k\xF2 ISO",
        date: "\u1ECDj\u1ECD\u0301 ISO",
        time: "\xE0k\xF3k\xF2 ISO",
        duration: "\xE0k\xF3k\xF2 t\xF3 p\xE9 ISO",
        ipv4: "\xE0d\xEDr\u1EB9\u0301s\xEC IPv4",
        ipv6: "\xE0d\xEDr\u1EB9\u0301s\xEC IPv6",
        cidrv4: "\xE0gb\xE8gb\xE8 IPv4",
        cidrv6: "\xE0gb\xE8gb\xE8 IPv6",
        base64: "\u1ECD\u0300r\u1ECD\u0300 t\xED a k\u1ECD\u0301 n\xED base64",
        base64url: "\u1ECD\u0300r\u1ECD\u0300 base64url",
        json_string: "\u1ECD\u0300r\u1ECD\u0300 JSON",
        e164: "n\u1ECD\u0301mb\xE0 E.164",
        jwt: "JWT",
        template_literal: "\u1EB9\u0300r\u1ECD \xECb\xE1w\u1ECDl\xE9"
      };
      const TypeDictionary = {
        nan: "NaN",
        number: "n\u1ECD\u0301mb\xE0",
        array: "akop\u1ECD"
      };
      return (issue) => {
        switch (issue.code) {
          case "invalid_type": {
            const expected = TypeDictionary[issue.expected] ?? issue.expected;
            const receivedType = util.parsedType(issue.input);
            const received = TypeDictionary[receivedType] ?? receivedType;
            if (/^[A-Z]/.test(issue.expected)) {
              return `\xCCb\xE1w\u1ECDl\xE9 a\u1E63\xEC\u1E63e: a n\xED l\xE1ti fi instanceof ${issue.expected}, \xE0m\u1ECD\u0300 a r\xED ${received}`;
            }
            return `\xCCb\xE1w\u1ECDl\xE9 a\u1E63\xEC\u1E63e: a n\xED l\xE1ti fi ${expected}, \xE0m\u1ECD\u0300 a r\xED ${received}`;
          }
          case "invalid_value":
            if (issue.values.length === 1)
              return `\xCCb\xE1w\u1ECDl\xE9 a\u1E63\xEC\u1E63e: a n\xED l\xE1ti fi ${util.stringifyPrimitive(issue.values[0])}`;
            return `\xC0\u1E63\xE0y\xE0n a\u1E63\xEC\u1E63e: yan \u1ECD\u0300kan l\xE1ra ${util.joinValues(issue.values, "|")}`;
          case "too_big": {
            const adj = issue.inclusive ? "<=" : "<";
            const sizing = getSizing(issue.origin);
            if (sizing)
              return `T\xF3 p\u1ECD\u0300 j\xF9: a n\xED l\xE1ti j\u1EB9\u0301 p\xE9 ${issue.origin ?? "iye"} ${sizing.verb} ${adj}${issue.maximum} ${sizing.unit}`;
            return `T\xF3 p\u1ECD\u0300 j\xF9: a n\xED l\xE1ti j\u1EB9\u0301 ${adj}${issue.maximum}`;
          }
          case "too_small": {
            const adj = issue.inclusive ? ">=" : ">";
            const sizing = getSizing(issue.origin);
            if (sizing)
              return `K\xE9r\xE9 ju: a n\xED l\xE1ti j\u1EB9\u0301 p\xE9 ${issue.origin} ${sizing.verb} ${adj}${issue.minimum} ${sizing.unit}`;
            return `K\xE9r\xE9 ju: a n\xED l\xE1ti j\u1EB9\u0301 ${adj}${issue.minimum}`;
          }
          case "invalid_format": {
            const _issue = issue;
            if (_issue.format === "starts_with")
              return `\u1ECC\u0300r\u1ECD\u0300 a\u1E63\xEC\u1E63e: gb\u1ECD\u0301d\u1ECD\u0300 b\u1EB9\u0300r\u1EB9\u0300 p\u1EB9\u0300l\xFA "${_issue.prefix}"`;
            if (_issue.format === "ends_with")
              return `\u1ECC\u0300r\u1ECD\u0300 a\u1E63\xEC\u1E63e: gb\u1ECD\u0301d\u1ECD\u0300 par\xED p\u1EB9\u0300l\xFA "${_issue.suffix}"`;
            if (_issue.format === "includes")
              return `\u1ECC\u0300r\u1ECD\u0300 a\u1E63\xEC\u1E63e: gb\u1ECD\u0301d\u1ECD\u0300 n\xED "${_issue.includes}"`;
            if (_issue.format === "regex")
              return `\u1ECC\u0300r\u1ECD\u0300 a\u1E63\xEC\u1E63e: gb\u1ECD\u0301d\u1ECD\u0300 b\xE1 \xE0p\u1EB9\u1EB9r\u1EB9 mu ${_issue.pattern}`;
            return `A\u1E63\xEC\u1E63e: ${FormatDictionary[_issue.format] ?? issue.format}`;
          }
          case "not_multiple_of":
            return `N\u1ECD\u0301mb\xE0 a\u1E63\xEC\u1E63e: gb\u1ECD\u0301d\u1ECD\u0300 j\u1EB9\u0301 \xE8y\xE0 p\xEDp\xEDn ti ${issue.divisor}`;
          case "unrecognized_keys":
            return `B\u1ECDt\xECn\xEC \xE0\xECm\u1ECD\u0300: ${util.joinValues(issue.keys, ", ")}`;
          case "invalid_key":
            return `B\u1ECDt\xECn\xEC a\u1E63\xEC\u1E63e n\xEDn\xFA ${issue.origin}`;
          case "invalid_union":
            return "\xCCb\xE1w\u1ECDl\xE9 a\u1E63\xEC\u1E63e";
          case "invalid_element":
            return `Iye a\u1E63\xEC\u1E63e n\xEDn\xFA ${issue.origin}`;
          default:
            return "\xCCb\xE1w\u1ECDl\xE9 a\u1E63\xEC\u1E63e";
        }
      };
    }, "error");
    function default_1() {
      return {
        localeError: error()
      };
    }
    __name(default_1, "default_1");
    module2.exports = exports2.default;
  }
});

// node_modules/zod/v4/locales/index.cjs
var require_locales = __commonJS({
  "node_modules/zod/v4/locales/index.cjs"(exports2) {
    "use strict";
    var __importDefault = exports2 && exports2.__importDefault || function(mod) {
      return mod && mod.__esModule ? mod : { "default": mod };
    };
    Object.defineProperty(exports2, "__esModule", { value: true });
    exports2.yo = exports2.zhTW = exports2.zhCN = exports2.vi = exports2.uz = exports2.ur = exports2.uk = exports2.ua = exports2.tr = exports2.th = exports2.ta = exports2.sv = exports2.sl = exports2.ru = exports2.pt = exports2.pl = exports2.ps = exports2.ota = exports2.no = exports2.nl = exports2.ms = exports2.mk = exports2.lt = exports2.ko = exports2.km = exports2.kh = exports2.ka = exports2.ja = exports2.it = exports2.is = exports2.id = exports2.hy = exports2.hu = exports2.he = exports2.frCA = exports2.fr = exports2.fi = exports2.fa = exports2.es = exports2.eo = exports2.en = exports2.de = exports2.da = exports2.cs = exports2.ca = exports2.bg = exports2.be = exports2.az = exports2.ar = void 0;
    var ar_js_1 = require_ar();
    Object.defineProperty(exports2, "ar", { enumerable: true, get: /* @__PURE__ */ __name(function() {
      return __importDefault(ar_js_1).default;
    }, "get") });
    var az_js_1 = require_az();
    Object.defineProperty(exports2, "az", { enumerable: true, get: /* @__PURE__ */ __name(function() {
      return __importDefault(az_js_1).default;
    }, "get") });
    var be_js_1 = require_be();
    Object.defineProperty(exports2, "be", { enumerable: true, get: /* @__PURE__ */ __name(function() {
      return __importDefault(be_js_1).default;
    }, "get") });
    var bg_js_1 = require_bg();
    Object.defineProperty(exports2, "bg", { enumerable: true, get: /* @__PURE__ */ __name(function() {
      return __importDefault(bg_js_1).default;
    }, "get") });
    var ca_js_1 = require_ca();
    Object.defineProperty(exports2, "ca", { enumerable: true, get: /* @__PURE__ */ __name(function() {
      return __importDefault(ca_js_1).default;
    }, "get") });
    var cs_js_1 = require_cs();
    Object.defineProperty(exports2, "cs", { enumerable: true, get: /* @__PURE__ */ __name(function() {
      return __importDefault(cs_js_1).default;
    }, "get") });
    var da_js_1 = require_da();
    Object.defineProperty(exports2, "da", { enumerable: true, get: /* @__PURE__ */ __name(function() {
      return __importDefault(da_js_1).default;
    }, "get") });
    var de_js_1 = require_de();
    Object.defineProperty(exports2, "de", { enumerable: true, get: /* @__PURE__ */ __name(function() {
      return __importDefault(de_js_1).default;
    }, "get") });
    var en_js_1 = require_en();
    Object.defineProperty(exports2, "en", { enumerable: true, get: /* @__PURE__ */ __name(function() {
      return __importDefault(en_js_1).default;
    }, "get") });
    var eo_js_1 = require_eo();
    Object.defineProperty(exports2, "eo", { enumerable: true, get: /* @__PURE__ */ __name(function() {
      return __importDefault(eo_js_1).default;
    }, "get") });
    var es_js_1 = require_es();
    Object.defineProperty(exports2, "es", { enumerable: true, get: /* @__PURE__ */ __name(function() {
      return __importDefault(es_js_1).default;
    }, "get") });
    var fa_js_1 = require_fa();
    Object.defineProperty(exports2, "fa", { enumerable: true, get: /* @__PURE__ */ __name(function() {
      return __importDefault(fa_js_1).default;
    }, "get") });
    var fi_js_1 = require_fi();
    Object.defineProperty(exports2, "fi", { enumerable: true, get: /* @__PURE__ */ __name(function() {
      return __importDefault(fi_js_1).default;
    }, "get") });
    var fr_js_1 = require_fr();
    Object.defineProperty(exports2, "fr", { enumerable: true, get: /* @__PURE__ */ __name(function() {
      return __importDefault(fr_js_1).default;
    }, "get") });
    var fr_CA_js_1 = require_fr_CA();
    Object.defineProperty(exports2, "frCA", { enumerable: true, get: /* @__PURE__ */ __name(function() {
      return __importDefault(fr_CA_js_1).default;
    }, "get") });
    var he_js_1 = require_he();
    Object.defineProperty(exports2, "he", { enumerable: true, get: /* @__PURE__ */ __name(function() {
      return __importDefault(he_js_1).default;
    }, "get") });
    var hu_js_1 = require_hu();
    Object.defineProperty(exports2, "hu", { enumerable: true, get: /* @__PURE__ */ __name(function() {
      return __importDefault(hu_js_1).default;
    }, "get") });
    var hy_js_1 = require_hy();
    Object.defineProperty(exports2, "hy", { enumerable: true, get: /* @__PURE__ */ __name(function() {
      return __importDefault(hy_js_1).default;
    }, "get") });
    var id_js_1 = require_id();
    Object.defineProperty(exports2, "id", { enumerable: true, get: /* @__PURE__ */ __name(function() {
      return __importDefault(id_js_1).default;
    }, "get") });
    var is_js_1 = require_is();
    Object.defineProperty(exports2, "is", { enumerable: true, get: /* @__PURE__ */ __name(function() {
      return __importDefault(is_js_1).default;
    }, "get") });
    var it_js_1 = require_it();
    Object.defineProperty(exports2, "it", { enumerable: true, get: /* @__PURE__ */ __name(function() {
      return __importDefault(it_js_1).default;
    }, "get") });
    var ja_js_1 = require_ja();
    Object.defineProperty(exports2, "ja", { enumerable: true, get: /* @__PURE__ */ __name(function() {
      return __importDefault(ja_js_1).default;
    }, "get") });
    var ka_js_1 = require_ka();
    Object.defineProperty(exports2, "ka", { enumerable: true, get: /* @__PURE__ */ __name(function() {
      return __importDefault(ka_js_1).default;
    }, "get") });
    var kh_js_1 = require_kh();
    Object.defineProperty(exports2, "kh", { enumerable: true, get: /* @__PURE__ */ __name(function() {
      return __importDefault(kh_js_1).default;
    }, "get") });
    var km_js_1 = require_km();
    Object.defineProperty(exports2, "km", { enumerable: true, get: /* @__PURE__ */ __name(function() {
      return __importDefault(km_js_1).default;
    }, "get") });
    var ko_js_1 = require_ko();
    Object.defineProperty(exports2, "ko", { enumerable: true, get: /* @__PURE__ */ __name(function() {
      return __importDefault(ko_js_1).default;
    }, "get") });
    var lt_js_1 = require_lt();
    Object.defineProperty(exports2, "lt", { enumerable: true, get: /* @__PURE__ */ __name(function() {
      return __importDefault(lt_js_1).default;
    }, "get") });
    var mk_js_1 = require_mk();
    Object.defineProperty(exports2, "mk", { enumerable: true, get: /* @__PURE__ */ __name(function() {
      return __importDefault(mk_js_1).default;
    }, "get") });
    var ms_js_1 = require_ms();
    Object.defineProperty(exports2, "ms", { enumerable: true, get: /* @__PURE__ */ __name(function() {
      return __importDefault(ms_js_1).default;
    }, "get") });
    var nl_js_1 = require_nl();
    Object.defineProperty(exports2, "nl", { enumerable: true, get: /* @__PURE__ */ __name(function() {
      return __importDefault(nl_js_1).default;
    }, "get") });
    var no_js_1 = require_no();
    Object.defineProperty(exports2, "no", { enumerable: true, get: /* @__PURE__ */ __name(function() {
      return __importDefault(no_js_1).default;
    }, "get") });
    var ota_js_1 = require_ota();
    Object.defineProperty(exports2, "ota", { enumerable: true, get: /* @__PURE__ */ __name(function() {
      return __importDefault(ota_js_1).default;
    }, "get") });
    var ps_js_1 = require_ps();
    Object.defineProperty(exports2, "ps", { enumerable: true, get: /* @__PURE__ */ __name(function() {
      return __importDefault(ps_js_1).default;
    }, "get") });
    var pl_js_1 = require_pl();
    Object.defineProperty(exports2, "pl", { enumerable: true, get: /* @__PURE__ */ __name(function() {
      return __importDefault(pl_js_1).default;
    }, "get") });
    var pt_js_1 = require_pt();
    Object.defineProperty(exports2, "pt", { enumerable: true, get: /* @__PURE__ */ __name(function() {
      return __importDefault(pt_js_1).default;
    }, "get") });
    var ru_js_1 = require_ru();
    Object.defineProperty(exports2, "ru", { enumerable: true, get: /* @__PURE__ */ __name(function() {
      return __importDefault(ru_js_1).default;
    }, "get") });
    var sl_js_1 = require_sl();
    Object.defineProperty(exports2, "sl", { enumerable: true, get: /* @__PURE__ */ __name(function() {
      return __importDefault(sl_js_1).default;
    }, "get") });
    var sv_js_1 = require_sv();
    Object.defineProperty(exports2, "sv", { enumerable: true, get: /* @__PURE__ */ __name(function() {
      return __importDefault(sv_js_1).default;
    }, "get") });
    var ta_js_1 = require_ta();
    Object.defineProperty(exports2, "ta", { enumerable: true, get: /* @__PURE__ */ __name(function() {
      return __importDefault(ta_js_1).default;
    }, "get") });
    var th_js_1 = require_th();
    Object.defineProperty(exports2, "th", { enumerable: true, get: /* @__PURE__ */ __name(function() {
      return __importDefault(th_js_1).default;
    }, "get") });
    var tr_js_1 = require_tr();
    Object.defineProperty(exports2, "tr", { enumerable: true, get: /* @__PURE__ */ __name(function() {
      return __importDefault(tr_js_1).default;
    }, "get") });
    var ua_js_1 = require_ua();
    Object.defineProperty(exports2, "ua", { enumerable: true, get: /* @__PURE__ */ __name(function() {
      return __importDefault(ua_js_1).default;
    }, "get") });
    var uk_js_1 = require_uk();
    Object.defineProperty(exports2, "uk", { enumerable: true, get: /* @__PURE__ */ __name(function() {
      return __importDefault(uk_js_1).default;
    }, "get") });
    var ur_js_1 = require_ur();
    Object.defineProperty(exports2, "ur", { enumerable: true, get: /* @__PURE__ */ __name(function() {
      return __importDefault(ur_js_1).default;
    }, "get") });
    var uz_js_1 = require_uz();
    Object.defineProperty(exports2, "uz", { enumerable: true, get: /* @__PURE__ */ __name(function() {
      return __importDefault(uz_js_1).default;
    }, "get") });
    var vi_js_1 = require_vi();
    Object.defineProperty(exports2, "vi", { enumerable: true, get: /* @__PURE__ */ __name(function() {
      return __importDefault(vi_js_1).default;
    }, "get") });
    var zh_CN_js_1 = require_zh_CN();
    Object.defineProperty(exports2, "zhCN", { enumerable: true, get: /* @__PURE__ */ __name(function() {
      return __importDefault(zh_CN_js_1).default;
    }, "get") });
    var zh_TW_js_1 = require_zh_TW();
    Object.defineProperty(exports2, "zhTW", { enumerable: true, get: /* @__PURE__ */ __name(function() {
      return __importDefault(zh_TW_js_1).default;
    }, "get") });
    var yo_js_1 = require_yo();
    Object.defineProperty(exports2, "yo", { enumerable: true, get: /* @__PURE__ */ __name(function() {
      return __importDefault(yo_js_1).default;
    }, "get") });
  }
});

// node_modules/zod/v4/core/registries.cjs
var require_registries = __commonJS({
  "node_modules/zod/v4/core/registries.cjs"(exports2) {
    "use strict";
    var _a;
    Object.defineProperty(exports2, "__esModule", { value: true });
    exports2.globalRegistry = exports2.$ZodRegistry = exports2.$input = exports2.$output = void 0;
    exports2.registry = registry;
    exports2.$output = /* @__PURE__ */ Symbol("ZodOutput");
    exports2.$input = /* @__PURE__ */ Symbol("ZodInput");
    var $ZodRegistry = class {
      static {
        __name(this, "$ZodRegistry");
      }
      constructor() {
        this._map = /* @__PURE__ */ new WeakMap();
        this._idmap = /* @__PURE__ */ new Map();
      }
      add(schema, ..._meta) {
        const meta = _meta[0];
        this._map.set(schema, meta);
        if (meta && typeof meta === "object" && "id" in meta) {
          this._idmap.set(meta.id, schema);
        }
        return this;
      }
      clear() {
        this._map = /* @__PURE__ */ new WeakMap();
        this._idmap = /* @__PURE__ */ new Map();
        return this;
      }
      remove(schema) {
        const meta = this._map.get(schema);
        if (meta && typeof meta === "object" && "id" in meta) {
          this._idmap.delete(meta.id);
        }
        this._map.delete(schema);
        return this;
      }
      get(schema) {
        const p = schema._zod.parent;
        if (p) {
          const pm = { ...this.get(p) ?? {} };
          delete pm.id;
          const f = { ...pm, ...this._map.get(schema) };
          return Object.keys(f).length ? f : void 0;
        }
        return this._map.get(schema);
      }
      has(schema) {
        return this._map.has(schema);
      }
    };
    exports2.$ZodRegistry = $ZodRegistry;
    function registry() {
      return new $ZodRegistry();
    }
    __name(registry, "registry");
    (_a = globalThis).__zod_globalRegistry ?? (_a.__zod_globalRegistry = registry());
    exports2.globalRegistry = globalThis.__zod_globalRegistry;
  }
});

// node_modules/zod/v4/core/api.cjs
var require_api = __commonJS({
  "node_modules/zod/v4/core/api.cjs"(exports2) {
    "use strict";
    var __createBinding = exports2 && exports2.__createBinding || (Object.create ? (function(o, m, k, k2) {
      if (k2 === void 0) k2 = k;
      var desc = Object.getOwnPropertyDescriptor(m, k);
      if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
        desc = { enumerable: true, get: /* @__PURE__ */ __name(function() {
          return m[k];
        }, "get") };
      }
      Object.defineProperty(o, k2, desc);
    }) : (function(o, m, k, k2) {
      if (k2 === void 0) k2 = k;
      o[k2] = m[k];
    }));
    var __setModuleDefault = exports2 && exports2.__setModuleDefault || (Object.create ? (function(o, v) {
      Object.defineProperty(o, "default", { enumerable: true, value: v });
    }) : function(o, v) {
      o["default"] = v;
    });
    var __importStar = exports2 && exports2.__importStar || function(mod) {
      if (mod && mod.__esModule) return mod;
      var result = {};
      if (mod != null) {
        for (var k in mod) if (k !== "default" && Object.prototype.hasOwnProperty.call(mod, k)) __createBinding(result, mod, k);
      }
      __setModuleDefault(result, mod);
      return result;
    };
    Object.defineProperty(exports2, "__esModule", { value: true });
    exports2.TimePrecision = void 0;
    exports2._string = _string;
    exports2._coercedString = _coercedString;
    exports2._email = _email;
    exports2._guid = _guid;
    exports2._uuid = _uuid;
    exports2._uuidv4 = _uuidv4;
    exports2._uuidv6 = _uuidv6;
    exports2._uuidv7 = _uuidv7;
    exports2._url = _url;
    exports2._emoji = _emoji;
    exports2._nanoid = _nanoid;
    exports2._cuid = _cuid;
    exports2._cuid2 = _cuid2;
    exports2._ulid = _ulid;
    exports2._xid = _xid;
    exports2._ksuid = _ksuid;
    exports2._ipv4 = _ipv4;
    exports2._ipv6 = _ipv6;
    exports2._mac = _mac;
    exports2._cidrv4 = _cidrv4;
    exports2._cidrv6 = _cidrv6;
    exports2._base64 = _base64;
    exports2._base64url = _base64url;
    exports2._e164 = _e164;
    exports2._jwt = _jwt;
    exports2._isoDateTime = _isoDateTime;
    exports2._isoDate = _isoDate;
    exports2._isoTime = _isoTime;
    exports2._isoDuration = _isoDuration;
    exports2._number = _number;
    exports2._coercedNumber = _coercedNumber;
    exports2._int = _int;
    exports2._float32 = _float32;
    exports2._float64 = _float64;
    exports2._int32 = _int32;
    exports2._uint32 = _uint32;
    exports2._boolean = _boolean;
    exports2._coercedBoolean = _coercedBoolean;
    exports2._bigint = _bigint;
    exports2._coercedBigint = _coercedBigint;
    exports2._int64 = _int64;
    exports2._uint64 = _uint64;
    exports2._symbol = _symbol;
    exports2._undefined = _undefined;
    exports2._null = _null;
    exports2._any = _any;
    exports2._unknown = _unknown;
    exports2._never = _never;
    exports2._void = _void;
    exports2._date = _date;
    exports2._coercedDate = _coercedDate;
    exports2._nan = _nan;
    exports2._lt = _lt;
    exports2._lte = _lte;
    exports2._max = _lte;
    exports2._lte = _lte;
    exports2._max = _lte;
    exports2._gt = _gt;
    exports2._gte = _gte;
    exports2._min = _gte;
    exports2._gte = _gte;
    exports2._min = _gte;
    exports2._positive = _positive;
    exports2._negative = _negative;
    exports2._nonpositive = _nonpositive;
    exports2._nonnegative = _nonnegative;
    exports2._multipleOf = _multipleOf;
    exports2._maxSize = _maxSize;
    exports2._minSize = _minSize;
    exports2._size = _size;
    exports2._maxLength = _maxLength;
    exports2._minLength = _minLength;
    exports2._length = _length;
    exports2._regex = _regex;
    exports2._lowercase = _lowercase;
    exports2._uppercase = _uppercase;
    exports2._includes = _includes;
    exports2._startsWith = _startsWith;
    exports2._endsWith = _endsWith;
    exports2._property = _property;
    exports2._mime = _mime;
    exports2._overwrite = _overwrite;
    exports2._normalize = _normalize;
    exports2._trim = _trim;
    exports2._toLowerCase = _toLowerCase;
    exports2._toUpperCase = _toUpperCase;
    exports2._slugify = _slugify;
    exports2._array = _array;
    exports2._union = _union;
    exports2._xor = _xor;
    exports2._discriminatedUnion = _discriminatedUnion;
    exports2._intersection = _intersection;
    exports2._tuple = _tuple;
    exports2._record = _record;
    exports2._map = _map;
    exports2._set = _set;
    exports2._enum = _enum;
    exports2._nativeEnum = _nativeEnum;
    exports2._literal = _literal;
    exports2._file = _file;
    exports2._transform = _transform;
    exports2._optional = _optional;
    exports2._nullable = _nullable;
    exports2._default = _default;
    exports2._nonoptional = _nonoptional;
    exports2._success = _success;
    exports2._catch = _catch;
    exports2._pipe = _pipe;
    exports2._readonly = _readonly;
    exports2._templateLiteral = _templateLiteral;
    exports2._lazy = _lazy;
    exports2._promise = _promise;
    exports2._custom = _custom;
    exports2._refine = _refine;
    exports2._superRefine = _superRefine;
    exports2._check = _check;
    exports2.describe = describe;
    exports2.meta = meta;
    exports2._stringbool = _stringbool;
    exports2._stringFormat = _stringFormat;
    var checks = __importStar(require_checks());
    var registries = __importStar(require_registries());
    var schemas = __importStar(require_schemas());
    var util = __importStar(require_util());
    // @__NO_SIDE_EFFECTS__
    function _string(Class, params) {
      return new Class({
        type: "string",
        ...util.normalizeParams(params)
      });
    }
    __name(_string, "_string");
    // @__NO_SIDE_EFFECTS__
    function _coercedString(Class, params) {
      return new Class({
        type: "string",
        coerce: true,
        ...util.normalizeParams(params)
      });
    }
    __name(_coercedString, "_coercedString");
    // @__NO_SIDE_EFFECTS__
    function _email(Class, params) {
      return new Class({
        type: "string",
        format: "email",
        check: "string_format",
        abort: false,
        ...util.normalizeParams(params)
      });
    }
    __name(_email, "_email");
    // @__NO_SIDE_EFFECTS__
    function _guid(Class, params) {
      return new Class({
        type: "string",
        format: "guid",
        check: "string_format",
        abort: false,
        ...util.normalizeParams(params)
      });
    }
    __name(_guid, "_guid");
    // @__NO_SIDE_EFFECTS__
    function _uuid(Class, params) {
      return new Class({
        type: "string",
        format: "uuid",
        check: "string_format",
        abort: false,
        ...util.normalizeParams(params)
      });
    }
    __name(_uuid, "_uuid");
    // @__NO_SIDE_EFFECTS__
    function _uuidv4(Class, params) {
      return new Class({
        type: "string",
        format: "uuid",
        check: "string_format",
        abort: false,
        version: "v4",
        ...util.normalizeParams(params)
      });
    }
    __name(_uuidv4, "_uuidv4");
    // @__NO_SIDE_EFFECTS__
    function _uuidv6(Class, params) {
      return new Class({
        type: "string",
        format: "uuid",
        check: "string_format",
        abort: false,
        version: "v6",
        ...util.normalizeParams(params)
      });
    }
    __name(_uuidv6, "_uuidv6");
    // @__NO_SIDE_EFFECTS__
    function _uuidv7(Class, params) {
      return new Class({
        type: "string",
        format: "uuid",
        check: "string_format",
        abort: false,
        version: "v7",
        ...util.normalizeParams(params)
      });
    }
    __name(_uuidv7, "_uuidv7");
    // @__NO_SIDE_EFFECTS__
    function _url(Class, params) {
      return new Class({
        type: "string",
        format: "url",
        check: "string_format",
        abort: false,
        ...util.normalizeParams(params)
      });
    }
    __name(_url, "_url");
    // @__NO_SIDE_EFFECTS__
    function _emoji(Class, params) {
      return new Class({
        type: "string",
        format: "emoji",
        check: "string_format",
        abort: false,
        ...util.normalizeParams(params)
      });
    }
    __name(_emoji, "_emoji");
    // @__NO_SIDE_EFFECTS__
    function _nanoid(Class, params) {
      return new Class({
        type: "string",
        format: "nanoid",
        check: "string_format",
        abort: false,
        ...util.normalizeParams(params)
      });
    }
    __name(_nanoid, "_nanoid");
    // @__NO_SIDE_EFFECTS__
    function _cuid(Class, params) {
      return new Class({
        type: "string",
        format: "cuid",
        check: "string_format",
        abort: false,
        ...util.normalizeParams(params)
      });
    }
    __name(_cuid, "_cuid");
    // @__NO_SIDE_EFFECTS__
    function _cuid2(Class, params) {
      return new Class({
        type: "string",
        format: "cuid2",
        check: "string_format",
        abort: false,
        ...util.normalizeParams(params)
      });
    }
    __name(_cuid2, "_cuid2");
    // @__NO_SIDE_EFFECTS__
    function _ulid(Class, params) {
      return new Class({
        type: "string",
        format: "ulid",
        check: "string_format",
        abort: false,
        ...util.normalizeParams(params)
      });
    }
    __name(_ulid, "_ulid");
    // @__NO_SIDE_EFFECTS__
    function _xid(Class, params) {
      return new Class({
        type: "string",
        format: "xid",
        check: "string_format",
        abort: false,
        ...util.normalizeParams(params)
      });
    }
    __name(_xid, "_xid");
    // @__NO_SIDE_EFFECTS__
    function _ksuid(Class, params) {
      return new Class({
        type: "string",
        format: "ksuid",
        check: "string_format",
        abort: false,
        ...util.normalizeParams(params)
      });
    }
    __name(_ksuid, "_ksuid");
    // @__NO_SIDE_EFFECTS__
    function _ipv4(Class, params) {
      return new Class({
        type: "string",
        format: "ipv4",
        check: "string_format",
        abort: false,
        ...util.normalizeParams(params)
      });
    }
    __name(_ipv4, "_ipv4");
    // @__NO_SIDE_EFFECTS__
    function _ipv6(Class, params) {
      return new Class({
        type: "string",
        format: "ipv6",
        check: "string_format",
        abort: false,
        ...util.normalizeParams(params)
      });
    }
    __name(_ipv6, "_ipv6");
    // @__NO_SIDE_EFFECTS__
    function _mac(Class, params) {
      return new Class({
        type: "string",
        format: "mac",
        check: "string_format",
        abort: false,
        ...util.normalizeParams(params)
      });
    }
    __name(_mac, "_mac");
    // @__NO_SIDE_EFFECTS__
    function _cidrv4(Class, params) {
      return new Class({
        type: "string",
        format: "cidrv4",
        check: "string_format",
        abort: false,
        ...util.normalizeParams(params)
      });
    }
    __name(_cidrv4, "_cidrv4");
    // @__NO_SIDE_EFFECTS__
    function _cidrv6(Class, params) {
      return new Class({
        type: "string",
        format: "cidrv6",
        check: "string_format",
        abort: false,
        ...util.normalizeParams(params)
      });
    }
    __name(_cidrv6, "_cidrv6");
    // @__NO_SIDE_EFFECTS__
    function _base64(Class, params) {
      return new Class({
        type: "string",
        format: "base64",
        check: "string_format",
        abort: false,
        ...util.normalizeParams(params)
      });
    }
    __name(_base64, "_base64");
    // @__NO_SIDE_EFFECTS__
    function _base64url(Class, params) {
      return new Class({
        type: "string",
        format: "base64url",
        check: "string_format",
        abort: false,
        ...util.normalizeParams(params)
      });
    }
    __name(_base64url, "_base64url");
    // @__NO_SIDE_EFFECTS__
    function _e164(Class, params) {
      return new Class({
        type: "string",
        format: "e164",
        check: "string_format",
        abort: false,
        ...util.normalizeParams(params)
      });
    }
    __name(_e164, "_e164");
    // @__NO_SIDE_EFFECTS__
    function _jwt(Class, params) {
      return new Class({
        type: "string",
        format: "jwt",
        check: "string_format",
        abort: false,
        ...util.normalizeParams(params)
      });
    }
    __name(_jwt, "_jwt");
    exports2.TimePrecision = {
      Any: null,
      Minute: -1,
      Second: 0,
      Millisecond: 3,
      Microsecond: 6
    };
    // @__NO_SIDE_EFFECTS__
    function _isoDateTime(Class, params) {
      return new Class({
        type: "string",
        format: "datetime",
        check: "string_format",
        offset: false,
        local: false,
        precision: null,
        ...util.normalizeParams(params)
      });
    }
    __name(_isoDateTime, "_isoDateTime");
    // @__NO_SIDE_EFFECTS__
    function _isoDate(Class, params) {
      return new Class({
        type: "string",
        format: "date",
        check: "string_format",
        ...util.normalizeParams(params)
      });
    }
    __name(_isoDate, "_isoDate");
    // @__NO_SIDE_EFFECTS__
    function _isoTime(Class, params) {
      return new Class({
        type: "string",
        format: "time",
        check: "string_format",
        precision: null,
        ...util.normalizeParams(params)
      });
    }
    __name(_isoTime, "_isoTime");
    // @__NO_SIDE_EFFECTS__
    function _isoDuration(Class, params) {
      return new Class({
        type: "string",
        format: "duration",
        check: "string_format",
        ...util.normalizeParams(params)
      });
    }
    __name(_isoDuration, "_isoDuration");
    // @__NO_SIDE_EFFECTS__
    function _number(Class, params) {
      return new Class({
        type: "number",
        checks: [],
        ...util.normalizeParams(params)
      });
    }
    __name(_number, "_number");
    // @__NO_SIDE_EFFECTS__
    function _coercedNumber(Class, params) {
      return new Class({
        type: "number",
        coerce: true,
        checks: [],
        ...util.normalizeParams(params)
      });
    }
    __name(_coercedNumber, "_coercedNumber");
    // @__NO_SIDE_EFFECTS__
    function _int(Class, params) {
      return new Class({
        type: "number",
        check: "number_format",
        abort: false,
        format: "safeint",
        ...util.normalizeParams(params)
      });
    }
    __name(_int, "_int");
    // @__NO_SIDE_EFFECTS__
    function _float32(Class, params) {
      return new Class({
        type: "number",
        check: "number_format",
        abort: false,
        format: "float32",
        ...util.normalizeParams(params)
      });
    }
    __name(_float32, "_float32");
    // @__NO_SIDE_EFFECTS__
    function _float64(Class, params) {
      return new Class({
        type: "number",
        check: "number_format",
        abort: false,
        format: "float64",
        ...util.normalizeParams(params)
      });
    }
    __name(_float64, "_float64");
    // @__NO_SIDE_EFFECTS__
    function _int32(Class, params) {
      return new Class({
        type: "number",
        check: "number_format",
        abort: false,
        format: "int32",
        ...util.normalizeParams(params)
      });
    }
    __name(_int32, "_int32");
    // @__NO_SIDE_EFFECTS__
    function _uint32(Class, params) {
      return new Class({
        type: "number",
        check: "number_format",
        abort: false,
        format: "uint32",
        ...util.normalizeParams(params)
      });
    }
    __name(_uint32, "_uint32");
    // @__NO_SIDE_EFFECTS__
    function _boolean(Class, params) {
      return new Class({
        type: "boolean",
        ...util.normalizeParams(params)
      });
    }
    __name(_boolean, "_boolean");
    // @__NO_SIDE_EFFECTS__
    function _coercedBoolean(Class, params) {
      return new Class({
        type: "boolean",
        coerce: true,
        ...util.normalizeParams(params)
      });
    }
    __name(_coercedBoolean, "_coercedBoolean");
    // @__NO_SIDE_EFFECTS__
    function _bigint(Class, params) {
      return new Class({
        type: "bigint",
        ...util.normalizeParams(params)
      });
    }
    __name(_bigint, "_bigint");
    // @__NO_SIDE_EFFECTS__
    function _coercedBigint(Class, params) {
      return new Class({
        type: "bigint",
        coerce: true,
        ...util.normalizeParams(params)
      });
    }
    __name(_coercedBigint, "_coercedBigint");
    // @__NO_SIDE_EFFECTS__
    function _int64(Class, params) {
      return new Class({
        type: "bigint",
        check: "bigint_format",
        abort: false,
        format: "int64",
        ...util.normalizeParams(params)
      });
    }
    __name(_int64, "_int64");
    // @__NO_SIDE_EFFECTS__
    function _uint64(Class, params) {
      return new Class({
        type: "bigint",
        check: "bigint_format",
        abort: false,
        format: "uint64",
        ...util.normalizeParams(params)
      });
    }
    __name(_uint64, "_uint64");
    // @__NO_SIDE_EFFECTS__
    function _symbol(Class, params) {
      return new Class({
        type: "symbol",
        ...util.normalizeParams(params)
      });
    }
    __name(_symbol, "_symbol");
    // @__NO_SIDE_EFFECTS__
    function _undefined(Class, params) {
      return new Class({
        type: "undefined",
        ...util.normalizeParams(params)
      });
    }
    __name(_undefined, "_undefined");
    // @__NO_SIDE_EFFECTS__
    function _null(Class, params) {
      return new Class({
        type: "null",
        ...util.normalizeParams(params)
      });
    }
    __name(_null, "_null");
    // @__NO_SIDE_EFFECTS__
    function _any(Class) {
      return new Class({
        type: "any"
      });
    }
    __name(_any, "_any");
    // @__NO_SIDE_EFFECTS__
    function _unknown(Class) {
      return new Class({
        type: "unknown"
      });
    }
    __name(_unknown, "_unknown");
    // @__NO_SIDE_EFFECTS__
    function _never(Class, params) {
      return new Class({
        type: "never",
        ...util.normalizeParams(params)
      });
    }
    __name(_never, "_never");
    // @__NO_SIDE_EFFECTS__
    function _void(Class, params) {
      return new Class({
        type: "void",
        ...util.normalizeParams(params)
      });
    }
    __name(_void, "_void");
    // @__NO_SIDE_EFFECTS__
    function _date(Class, params) {
      return new Class({
        type: "date",
        ...util.normalizeParams(params)
      });
    }
    __name(_date, "_date");
    // @__NO_SIDE_EFFECTS__
    function _coercedDate(Class, params) {
      return new Class({
        type: "date",
        coerce: true,
        ...util.normalizeParams(params)
      });
    }
    __name(_coercedDate, "_coercedDate");
    // @__NO_SIDE_EFFECTS__
    function _nan(Class, params) {
      return new Class({
        type: "nan",
        ...util.normalizeParams(params)
      });
    }
    __name(_nan, "_nan");
    // @__NO_SIDE_EFFECTS__
    function _lt(value, params) {
      return new checks.$ZodCheckLessThan({
        check: "less_than",
        ...util.normalizeParams(params),
        value,
        inclusive: false
      });
    }
    __name(_lt, "_lt");
    // @__NO_SIDE_EFFECTS__
    function _lte(value, params) {
      return new checks.$ZodCheckLessThan({
        check: "less_than",
        ...util.normalizeParams(params),
        value,
        inclusive: true
      });
    }
    __name(_lte, "_lte");
    // @__NO_SIDE_EFFECTS__
    function _gt(value, params) {
      return new checks.$ZodCheckGreaterThan({
        check: "greater_than",
        ...util.normalizeParams(params),
        value,
        inclusive: false
      });
    }
    __name(_gt, "_gt");
    // @__NO_SIDE_EFFECTS__
    function _gte(value, params) {
      return new checks.$ZodCheckGreaterThan({
        check: "greater_than",
        ...util.normalizeParams(params),
        value,
        inclusive: true
      });
    }
    __name(_gte, "_gte");
    // @__NO_SIDE_EFFECTS__
    function _positive(params) {
      return /* @__PURE__ */ _gt(0, params);
    }
    __name(_positive, "_positive");
    // @__NO_SIDE_EFFECTS__
    function _negative(params) {
      return /* @__PURE__ */ _lt(0, params);
    }
    __name(_negative, "_negative");
    // @__NO_SIDE_EFFECTS__
    function _nonpositive(params) {
      return /* @__PURE__ */ _lte(0, params);
    }
    __name(_nonpositive, "_nonpositive");
    // @__NO_SIDE_EFFECTS__
    function _nonnegative(params) {
      return /* @__PURE__ */ _gte(0, params);
    }
    __name(_nonnegative, "_nonnegative");
    // @__NO_SIDE_EFFECTS__
    function _multipleOf(value, params) {
      return new checks.$ZodCheckMultipleOf({
        check: "multiple_of",
        ...util.normalizeParams(params),
        value
      });
    }
    __name(_multipleOf, "_multipleOf");
    // @__NO_SIDE_EFFECTS__
    function _maxSize(maximum, params) {
      return new checks.$ZodCheckMaxSize({
        check: "max_size",
        ...util.normalizeParams(params),
        maximum
      });
    }
    __name(_maxSize, "_maxSize");
    // @__NO_SIDE_EFFECTS__
    function _minSize(minimum, params) {
      return new checks.$ZodCheckMinSize({
        check: "min_size",
        ...util.normalizeParams(params),
        minimum
      });
    }
    __name(_minSize, "_minSize");
    // @__NO_SIDE_EFFECTS__
    function _size(size, params) {
      return new checks.$ZodCheckSizeEquals({
        check: "size_equals",
        ...util.normalizeParams(params),
        size
      });
    }
    __name(_size, "_size");
    // @__NO_SIDE_EFFECTS__
    function _maxLength(maximum, params) {
      const ch = new checks.$ZodCheckMaxLength({
        check: "max_length",
        ...util.normalizeParams(params),
        maximum
      });
      return ch;
    }
    __name(_maxLength, "_maxLength");
    // @__NO_SIDE_EFFECTS__
    function _minLength(minimum, params) {
      return new checks.$ZodCheckMinLength({
        check: "min_length",
        ...util.normalizeParams(params),
        minimum
      });
    }
    __name(_minLength, "_minLength");
    // @__NO_SIDE_EFFECTS__
    function _length(length, params) {
      return new checks.$ZodCheckLengthEquals({
        check: "length_equals",
        ...util.normalizeParams(params),
        length
      });
    }
    __name(_length, "_length");
    // @__NO_SIDE_EFFECTS__
    function _regex(pattern, params) {
      return new checks.$ZodCheckRegex({
        check: "string_format",
        format: "regex",
        ...util.normalizeParams(params),
        pattern
      });
    }
    __name(_regex, "_regex");
    // @__NO_SIDE_EFFECTS__
    function _lowercase(params) {
      return new checks.$ZodCheckLowerCase({
        check: "string_format",
        format: "lowercase",
        ...util.normalizeParams(params)
      });
    }
    __name(_lowercase, "_lowercase");
    // @__NO_SIDE_EFFECTS__
    function _uppercase(params) {
      return new checks.$ZodCheckUpperCase({
        check: "string_format",
        format: "uppercase",
        ...util.normalizeParams(params)
      });
    }
    __name(_uppercase, "_uppercase");
    // @__NO_SIDE_EFFECTS__
    function _includes(includes, params) {
      return new checks.$ZodCheckIncludes({
        check: "string_format",
        format: "includes",
        ...util.normalizeParams(params),
        includes
      });
    }
    __name(_includes, "_includes");
    // @__NO_SIDE_EFFECTS__
    function _startsWith(prefix, params) {
      return new checks.$ZodCheckStartsWith({
        check: "string_format",
        format: "starts_with",
        ...util.normalizeParams(params),
        prefix
      });
    }
    __name(_startsWith, "_startsWith");
    // @__NO_SIDE_EFFECTS__
    function _endsWith(suffix, params) {
      return new checks.$ZodCheckEndsWith({
        check: "string_format",
        format: "ends_with",
        ...util.normalizeParams(params),
        suffix
      });
    }
    __name(_endsWith, "_endsWith");
    // @__NO_SIDE_EFFECTS__
    function _property(property, schema, params) {
      return new checks.$ZodCheckProperty({
        check: "property",
        property,
        schema,
        ...util.normalizeParams(params)
      });
    }
    __name(_property, "_property");
    // @__NO_SIDE_EFFECTS__
    function _mime(types, params) {
      return new checks.$ZodCheckMimeType({
        check: "mime_type",
        mime: types,
        ...util.normalizeParams(params)
      });
    }
    __name(_mime, "_mime");
    // @__NO_SIDE_EFFECTS__
    function _overwrite(tx) {
      return new checks.$ZodCheckOverwrite({
        check: "overwrite",
        tx
      });
    }
    __name(_overwrite, "_overwrite");
    // @__NO_SIDE_EFFECTS__
    function _normalize(form) {
      return /* @__PURE__ */ _overwrite((input) => input.normalize(form));
    }
    __name(_normalize, "_normalize");
    // @__NO_SIDE_EFFECTS__
    function _trim() {
      return /* @__PURE__ */ _overwrite((input) => input.trim());
    }
    __name(_trim, "_trim");
    // @__NO_SIDE_EFFECTS__
    function _toLowerCase() {
      return /* @__PURE__ */ _overwrite((input) => input.toLowerCase());
    }
    __name(_toLowerCase, "_toLowerCase");
    // @__NO_SIDE_EFFECTS__
    function _toUpperCase() {
      return /* @__PURE__ */ _overwrite((input) => input.toUpperCase());
    }
    __name(_toUpperCase, "_toUpperCase");
    // @__NO_SIDE_EFFECTS__
    function _slugify() {
      return /* @__PURE__ */ _overwrite((input) => util.slugify(input));
    }
    __name(_slugify, "_slugify");
    // @__NO_SIDE_EFFECTS__
    function _array(Class, element, params) {
      return new Class({
        type: "array",
        element,
        // get element() {
        //   return element;
        // },
        ...util.normalizeParams(params)
      });
    }
    __name(_array, "_array");
    // @__NO_SIDE_EFFECTS__
    function _union(Class, options, params) {
      return new Class({
        type: "union",
        options,
        ...util.normalizeParams(params)
      });
    }
    __name(_union, "_union");
    function _xor(Class, options, params) {
      return new Class({
        type: "union",
        options,
        inclusive: false,
        ...util.normalizeParams(params)
      });
    }
    __name(_xor, "_xor");
    // @__NO_SIDE_EFFECTS__
    function _discriminatedUnion(Class, discriminator, options, params) {
      return new Class({
        type: "union",
        options,
        discriminator,
        ...util.normalizeParams(params)
      });
    }
    __name(_discriminatedUnion, "_discriminatedUnion");
    // @__NO_SIDE_EFFECTS__
    function _intersection(Class, left, right) {
      return new Class({
        type: "intersection",
        left,
        right
      });
    }
    __name(_intersection, "_intersection");
    // @__NO_SIDE_EFFECTS__
    function _tuple(Class, items, _paramsOrRest, _params) {
      const hasRest = _paramsOrRest instanceof schemas.$ZodType;
      const params = hasRest ? _params : _paramsOrRest;
      const rest = hasRest ? _paramsOrRest : null;
      return new Class({
        type: "tuple",
        items,
        rest,
        ...util.normalizeParams(params)
      });
    }
    __name(_tuple, "_tuple");
    // @__NO_SIDE_EFFECTS__
    function _record(Class, keyType, valueType, params) {
      return new Class({
        type: "record",
        keyType,
        valueType,
        ...util.normalizeParams(params)
      });
    }
    __name(_record, "_record");
    // @__NO_SIDE_EFFECTS__
    function _map(Class, keyType, valueType, params) {
      return new Class({
        type: "map",
        keyType,
        valueType,
        ...util.normalizeParams(params)
      });
    }
    __name(_map, "_map");
    // @__NO_SIDE_EFFECTS__
    function _set(Class, valueType, params) {
      return new Class({
        type: "set",
        valueType,
        ...util.normalizeParams(params)
      });
    }
    __name(_set, "_set");
    // @__NO_SIDE_EFFECTS__
    function _enum(Class, values, params) {
      const entries = Array.isArray(values) ? Object.fromEntries(values.map((v) => [v, v])) : values;
      return new Class({
        type: "enum",
        entries,
        ...util.normalizeParams(params)
      });
    }
    __name(_enum, "_enum");
    // @__NO_SIDE_EFFECTS__
    function _nativeEnum(Class, entries, params) {
      return new Class({
        type: "enum",
        entries,
        ...util.normalizeParams(params)
      });
    }
    __name(_nativeEnum, "_nativeEnum");
    // @__NO_SIDE_EFFECTS__
    function _literal(Class, value, params) {
      return new Class({
        type: "literal",
        values: Array.isArray(value) ? value : [value],
        ...util.normalizeParams(params)
      });
    }
    __name(_literal, "_literal");
    // @__NO_SIDE_EFFECTS__
    function _file(Class, params) {
      return new Class({
        type: "file",
        ...util.normalizeParams(params)
      });
    }
    __name(_file, "_file");
    // @__NO_SIDE_EFFECTS__
    function _transform(Class, fn) {
      return new Class({
        type: "transform",
        transform: fn
      });
    }
    __name(_transform, "_transform");
    // @__NO_SIDE_EFFECTS__
    function _optional(Class, innerType) {
      return new Class({
        type: "optional",
        innerType
      });
    }
    __name(_optional, "_optional");
    // @__NO_SIDE_EFFECTS__
    function _nullable(Class, innerType) {
      return new Class({
        type: "nullable",
        innerType
      });
    }
    __name(_nullable, "_nullable");
    // @__NO_SIDE_EFFECTS__
    function _default(Class, innerType, defaultValue) {
      return new Class({
        type: "default",
        innerType,
        get defaultValue() {
          return typeof defaultValue === "function" ? defaultValue() : util.shallowClone(defaultValue);
        }
      });
    }
    __name(_default, "_default");
    // @__NO_SIDE_EFFECTS__
    function _nonoptional(Class, innerType, params) {
      return new Class({
        type: "nonoptional",
        innerType,
        ...util.normalizeParams(params)
      });
    }
    __name(_nonoptional, "_nonoptional");
    // @__NO_SIDE_EFFECTS__
    function _success(Class, innerType) {
      return new Class({
        type: "success",
        innerType
      });
    }
    __name(_success, "_success");
    // @__NO_SIDE_EFFECTS__
    function _catch(Class, innerType, catchValue) {
      return new Class({
        type: "catch",
        innerType,
        catchValue: typeof catchValue === "function" ? catchValue : () => catchValue
      });
    }
    __name(_catch, "_catch");
    // @__NO_SIDE_EFFECTS__
    function _pipe(Class, in_, out) {
      return new Class({
        type: "pipe",
        in: in_,
        out
      });
    }
    __name(_pipe, "_pipe");
    // @__NO_SIDE_EFFECTS__
    function _readonly(Class, innerType) {
      return new Class({
        type: "readonly",
        innerType
      });
    }
    __name(_readonly, "_readonly");
    // @__NO_SIDE_EFFECTS__
    function _templateLiteral(Class, parts, params) {
      return new Class({
        type: "template_literal",
        parts,
        ...util.normalizeParams(params)
      });
    }
    __name(_templateLiteral, "_templateLiteral");
    // @__NO_SIDE_EFFECTS__
    function _lazy(Class, getter) {
      return new Class({
        type: "lazy",
        getter
      });
    }
    __name(_lazy, "_lazy");
    // @__NO_SIDE_EFFECTS__
    function _promise(Class, innerType) {
      return new Class({
        type: "promise",
        innerType
      });
    }
    __name(_promise, "_promise");
    // @__NO_SIDE_EFFECTS__
    function _custom(Class, fn, _params) {
      const norm = util.normalizeParams(_params);
      norm.abort ?? (norm.abort = true);
      const schema = new Class({
        type: "custom",
        check: "custom",
        fn,
        ...norm
      });
      return schema;
    }
    __name(_custom, "_custom");
    // @__NO_SIDE_EFFECTS__
    function _refine(Class, fn, _params) {
      const schema = new Class({
        type: "custom",
        check: "custom",
        fn,
        ...util.normalizeParams(_params)
      });
      return schema;
    }
    __name(_refine, "_refine");
    // @__NO_SIDE_EFFECTS__
    function _superRefine(fn) {
      const ch = /* @__PURE__ */ _check((payload) => {
        payload.addIssue = (issue) => {
          if (typeof issue === "string") {
            payload.issues.push(util.issue(issue, payload.value, ch._zod.def));
          } else {
            const _issue = issue;
            if (_issue.fatal)
              _issue.continue = false;
            _issue.code ?? (_issue.code = "custom");
            _issue.input ?? (_issue.input = payload.value);
            _issue.inst ?? (_issue.inst = ch);
            _issue.continue ?? (_issue.continue = !ch._zod.def.abort);
            payload.issues.push(util.issue(_issue));
          }
        };
        return fn(payload.value, payload);
      });
      return ch;
    }
    __name(_superRefine, "_superRefine");
    // @__NO_SIDE_EFFECTS__
    function _check(fn, params) {
      const ch = new checks.$ZodCheck({
        check: "custom",
        ...util.normalizeParams(params)
      });
      ch._zod.check = fn;
      return ch;
    }
    __name(_check, "_check");
    // @__NO_SIDE_EFFECTS__
    function describe(description) {
      const ch = new checks.$ZodCheck({ check: "describe" });
      ch._zod.onattach = [
        (inst) => {
          const existing = registries.globalRegistry.get(inst) ?? {};
          registries.globalRegistry.add(inst, { ...existing, description });
        }
      ];
      ch._zod.check = () => {
      };
      return ch;
    }
    __name(describe, "describe");
    // @__NO_SIDE_EFFECTS__
    function meta(metadata) {
      const ch = new checks.$ZodCheck({ check: "meta" });
      ch._zod.onattach = [
        (inst) => {
          const existing = registries.globalRegistry.get(inst) ?? {};
          registries.globalRegistry.add(inst, { ...existing, ...metadata });
        }
      ];
      ch._zod.check = () => {
      };
      return ch;
    }
    __name(meta, "meta");
    // @__NO_SIDE_EFFECTS__
    function _stringbool(Classes, _params) {
      const params = util.normalizeParams(_params);
      let truthyArray = params.truthy ?? ["true", "1", "yes", "on", "y", "enabled"];
      let falsyArray = params.falsy ?? ["false", "0", "no", "off", "n", "disabled"];
      if (params.case !== "sensitive") {
        truthyArray = truthyArray.map((v) => typeof v === "string" ? v.toLowerCase() : v);
        falsyArray = falsyArray.map((v) => typeof v === "string" ? v.toLowerCase() : v);
      }
      const truthySet = new Set(truthyArray);
      const falsySet = new Set(falsyArray);
      const _Codec = Classes.Codec ?? schemas.$ZodCodec;
      const _Boolean = Classes.Boolean ?? schemas.$ZodBoolean;
      const _String = Classes.String ?? schemas.$ZodString;
      const stringSchema = new _String({ type: "string", error: params.error });
      const booleanSchema = new _Boolean({ type: "boolean", error: params.error });
      const codec = new _Codec({
        type: "pipe",
        in: stringSchema,
        out: booleanSchema,
        transform: /* @__PURE__ */ __name(((input, payload) => {
          let data = input;
          if (params.case !== "sensitive")
            data = data.toLowerCase();
          if (truthySet.has(data)) {
            return true;
          } else if (falsySet.has(data)) {
            return false;
          } else {
            payload.issues.push({
              code: "invalid_value",
              expected: "stringbool",
              values: [...truthySet, ...falsySet],
              input: payload.value,
              inst: codec,
              continue: false
            });
            return {};
          }
        }), "transform"),
        reverseTransform: /* @__PURE__ */ __name(((input, _payload) => {
          if (input === true) {
            return truthyArray[0] || "true";
          } else {
            return falsyArray[0] || "false";
          }
        }), "reverseTransform"),
        error: params.error
      });
      return codec;
    }
    __name(_stringbool, "_stringbool");
    // @__NO_SIDE_EFFECTS__
    function _stringFormat(Class, format, fnOrRegex, _params = {}) {
      const params = util.normalizeParams(_params);
      const def = {
        ...util.normalizeParams(_params),
        check: "string_format",
        type: "string",
        format,
        fn: typeof fnOrRegex === "function" ? fnOrRegex : (val) => fnOrRegex.test(val),
        ...params
      };
      if (fnOrRegex instanceof RegExp) {
        def.pattern = fnOrRegex;
      }
      const inst = new Class(def);
      return inst;
    }
    __name(_stringFormat, "_stringFormat");
  }
});

// node_modules/zod/v4/core/to-json-schema.cjs
var require_to_json_schema = __commonJS({
  "node_modules/zod/v4/core/to-json-schema.cjs"(exports2) {
    "use strict";
    Object.defineProperty(exports2, "__esModule", { value: true });
    exports2.createStandardJSONSchemaMethod = exports2.createToJSONSchemaMethod = void 0;
    exports2.initializeContext = initializeContext;
    exports2.process = process2;
    exports2.extractDefs = extractDefs;
    exports2.finalize = finalize;
    var registries_js_1 = require_registries();
    function initializeContext(params) {
      let target = params?.target ?? "draft-2020-12";
      if (target === "draft-4")
        target = "draft-04";
      if (target === "draft-7")
        target = "draft-07";
      return {
        processors: params.processors ?? {},
        metadataRegistry: params?.metadata ?? registries_js_1.globalRegistry,
        target,
        unrepresentable: params?.unrepresentable ?? "throw",
        override: params?.override ?? (() => {
        }),
        io: params?.io ?? "output",
        counter: 0,
        seen: /* @__PURE__ */ new Map(),
        cycles: params?.cycles ?? "ref",
        reused: params?.reused ?? "inline",
        external: params?.external ?? void 0
      };
    }
    __name(initializeContext, "initializeContext");
    function process2(schema, ctx, _params = { path: [], schemaPath: [] }) {
      var _a;
      const def = schema._zod.def;
      const seen = ctx.seen.get(schema);
      if (seen) {
        seen.count++;
        const isCycle = _params.schemaPath.includes(schema);
        if (isCycle) {
          seen.cycle = _params.path;
        }
        return seen.schema;
      }
      const result = { schema: {}, count: 1, cycle: void 0, path: _params.path };
      ctx.seen.set(schema, result);
      const overrideSchema = schema._zod.toJSONSchema?.();
      if (overrideSchema) {
        result.schema = overrideSchema;
      } else {
        const params = {
          ..._params,
          schemaPath: [..._params.schemaPath, schema],
          path: _params.path
        };
        if (schema._zod.processJSONSchema) {
          schema._zod.processJSONSchema(ctx, result.schema, params);
        } else {
          const _json = result.schema;
          const processor = ctx.processors[def.type];
          if (!processor) {
            throw new Error(`[toJSONSchema]: Non-representable type encountered: ${def.type}`);
          }
          processor(schema, ctx, _json, params);
        }
        const parent = schema._zod.parent;
        if (parent) {
          if (!result.ref)
            result.ref = parent;
          process2(parent, ctx, params);
          ctx.seen.get(parent).isParent = true;
        }
      }
      const meta = ctx.metadataRegistry.get(schema);
      if (meta)
        Object.assign(result.schema, meta);
      if (ctx.io === "input" && isTransforming(schema)) {
        delete result.schema.examples;
        delete result.schema.default;
      }
      if (ctx.io === "input" && result.schema._prefault)
        (_a = result.schema).default ?? (_a.default = result.schema._prefault);
      delete result.schema._prefault;
      const _result = ctx.seen.get(schema);
      return _result.schema;
    }
    __name(process2, "process");
    function extractDefs(ctx, schema) {
      const root = ctx.seen.get(schema);
      if (!root)
        throw new Error("Unprocessed schema. This is a bug in Zod.");
      const idToSchema = /* @__PURE__ */ new Map();
      for (const entry of ctx.seen.entries()) {
        const id = ctx.metadataRegistry.get(entry[0])?.id;
        if (id) {
          const existing = idToSchema.get(id);
          if (existing && existing !== entry[0]) {
            throw new Error(`Duplicate schema id "${id}" detected during JSON Schema conversion. Two different schemas cannot share the same id when converted together.`);
          }
          idToSchema.set(id, entry[0]);
        }
      }
      const makeURI = /* @__PURE__ */ __name((entry) => {
        const defsSegment = ctx.target === "draft-2020-12" ? "$defs" : "definitions";
        if (ctx.external) {
          const externalId = ctx.external.registry.get(entry[0])?.id;
          const uriGenerator = ctx.external.uri ?? ((id2) => id2);
          if (externalId) {
            return { ref: uriGenerator(externalId) };
          }
          const id = entry[1].defId ?? entry[1].schema.id ?? `schema${ctx.counter++}`;
          entry[1].defId = id;
          return { defId: id, ref: `${uriGenerator("__shared")}#/${defsSegment}/${id}` };
        }
        if (entry[1] === root) {
          return { ref: "#" };
        }
        const uriPrefix = `#`;
        const defUriPrefix = `${uriPrefix}/${defsSegment}/`;
        const defId = entry[1].schema.id ?? `__schema${ctx.counter++}`;
        return { defId, ref: defUriPrefix + defId };
      }, "makeURI");
      const extractToDef = /* @__PURE__ */ __name((entry) => {
        if (entry[1].schema.$ref) {
          return;
        }
        const seen = entry[1];
        const { ref, defId } = makeURI(entry);
        seen.def = { ...seen.schema };
        if (defId)
          seen.defId = defId;
        const schema2 = seen.schema;
        for (const key in schema2) {
          delete schema2[key];
        }
        schema2.$ref = ref;
      }, "extractToDef");
      if (ctx.cycles === "throw") {
        for (const entry of ctx.seen.entries()) {
          const seen = entry[1];
          if (seen.cycle) {
            throw new Error(`Cycle detected: #/${seen.cycle?.join("/")}/<root>

Set the \`cycles\` parameter to \`"ref"\` to resolve cyclical schemas with defs.`);
          }
        }
      }
      for (const entry of ctx.seen.entries()) {
        const seen = entry[1];
        if (schema === entry[0]) {
          extractToDef(entry);
          continue;
        }
        if (ctx.external) {
          const ext = ctx.external.registry.get(entry[0])?.id;
          if (schema !== entry[0] && ext) {
            extractToDef(entry);
            continue;
          }
        }
        const id = ctx.metadataRegistry.get(entry[0])?.id;
        if (id) {
          extractToDef(entry);
          continue;
        }
        if (seen.cycle) {
          extractToDef(entry);
          continue;
        }
        if (seen.count > 1) {
          if (ctx.reused === "ref") {
            extractToDef(entry);
            continue;
          }
        }
      }
    }
    __name(extractDefs, "extractDefs");
    function finalize(ctx, schema) {
      const root = ctx.seen.get(schema);
      if (!root)
        throw new Error("Unprocessed schema. This is a bug in Zod.");
      const flattenRef = /* @__PURE__ */ __name((zodSchema) => {
        const seen = ctx.seen.get(zodSchema);
        if (seen.ref === null)
          return;
        const schema2 = seen.def ?? seen.schema;
        const _cached = { ...schema2 };
        const ref = seen.ref;
        seen.ref = null;
        if (ref) {
          flattenRef(ref);
          const refSeen = ctx.seen.get(ref);
          const refSchema = refSeen.schema;
          if (refSchema.$ref && (ctx.target === "draft-07" || ctx.target === "draft-04" || ctx.target === "openapi-3.0")) {
            schema2.allOf = schema2.allOf ?? [];
            schema2.allOf.push(refSchema);
          } else {
            Object.assign(schema2, refSchema);
          }
          Object.assign(schema2, _cached);
          const isParentRef = zodSchema._zod.parent === ref;
          if (isParentRef) {
            for (const key in schema2) {
              if (key === "$ref" || key === "allOf")
                continue;
              if (!(key in _cached)) {
                delete schema2[key];
              }
            }
          }
          if (refSchema.$ref && refSeen.def) {
            for (const key in schema2) {
              if (key === "$ref" || key === "allOf")
                continue;
              if (key in refSeen.def && JSON.stringify(schema2[key]) === JSON.stringify(refSeen.def[key])) {
                delete schema2[key];
              }
            }
          }
        }
        const parent = zodSchema._zod.parent;
        if (parent && parent !== ref) {
          flattenRef(parent);
          const parentSeen = ctx.seen.get(parent);
          if (parentSeen?.schema.$ref) {
            schema2.$ref = parentSeen.schema.$ref;
            if (parentSeen.def) {
              for (const key in schema2) {
                if (key === "$ref" || key === "allOf")
                  continue;
                if (key in parentSeen.def && JSON.stringify(schema2[key]) === JSON.stringify(parentSeen.def[key])) {
                  delete schema2[key];
                }
              }
            }
          }
        }
        ctx.override({
          zodSchema,
          jsonSchema: schema2,
          path: seen.path ?? []
        });
      }, "flattenRef");
      for (const entry of [...ctx.seen.entries()].reverse()) {
        flattenRef(entry[0]);
      }
      const result = {};
      if (ctx.target === "draft-2020-12") {
        result.$schema = "https://json-schema.org/draft/2020-12/schema";
      } else if (ctx.target === "draft-07") {
        result.$schema = "http://json-schema.org/draft-07/schema#";
      } else if (ctx.target === "draft-04") {
        result.$schema = "http://json-schema.org/draft-04/schema#";
      } else if (ctx.target === "openapi-3.0") {
      } else {
      }
      if (ctx.external?.uri) {
        const id = ctx.external.registry.get(schema)?.id;
        if (!id)
          throw new Error("Schema is missing an `id` property");
        result.$id = ctx.external.uri(id);
      }
      Object.assign(result, root.def ?? root.schema);
      const defs = ctx.external?.defs ?? {};
      for (const entry of ctx.seen.entries()) {
        const seen = entry[1];
        if (seen.def && seen.defId) {
          defs[seen.defId] = seen.def;
        }
      }
      if (ctx.external) {
      } else {
        if (Object.keys(defs).length > 0) {
          if (ctx.target === "draft-2020-12") {
            result.$defs = defs;
          } else {
            result.definitions = defs;
          }
        }
      }
      try {
        const finalized = JSON.parse(JSON.stringify(result));
        Object.defineProperty(finalized, "~standard", {
          value: {
            ...schema["~standard"],
            jsonSchema: {
              input: (0, exports2.createStandardJSONSchemaMethod)(schema, "input", ctx.processors),
              output: (0, exports2.createStandardJSONSchemaMethod)(schema, "output", ctx.processors)
            }
          },
          enumerable: false,
          writable: false
        });
        return finalized;
      } catch (_err) {
        throw new Error("Error converting schema to JSON.");
      }
    }
    __name(finalize, "finalize");
    function isTransforming(_schema, _ctx) {
      const ctx = _ctx ?? { seen: /* @__PURE__ */ new Set() };
      if (ctx.seen.has(_schema))
        return false;
      ctx.seen.add(_schema);
      const def = _schema._zod.def;
      if (def.type === "transform")
        return true;
      if (def.type === "array")
        return isTransforming(def.element, ctx);
      if (def.type === "set")
        return isTransforming(def.valueType, ctx);
      if (def.type === "lazy")
        return isTransforming(def.getter(), ctx);
      if (def.type === "promise" || def.type === "optional" || def.type === "nonoptional" || def.type === "nullable" || def.type === "readonly" || def.type === "default" || def.type === "prefault") {
        return isTransforming(def.innerType, ctx);
      }
      if (def.type === "intersection") {
        return isTransforming(def.left, ctx) || isTransforming(def.right, ctx);
      }
      if (def.type === "record" || def.type === "map") {
        return isTransforming(def.keyType, ctx) || isTransforming(def.valueType, ctx);
      }
      if (def.type === "pipe") {
        return isTransforming(def.in, ctx) || isTransforming(def.out, ctx);
      }
      if (def.type === "object") {
        for (const key in def.shape) {
          if (isTransforming(def.shape[key], ctx))
            return true;
        }
        return false;
      }
      if (def.type === "union") {
        for (const option of def.options) {
          if (isTransforming(option, ctx))
            return true;
        }
        return false;
      }
      if (def.type === "tuple") {
        for (const item of def.items) {
          if (isTransforming(item, ctx))
            return true;
        }
        if (def.rest && isTransforming(def.rest, ctx))
          return true;
        return false;
      }
      return false;
    }
    __name(isTransforming, "isTransforming");
    var createToJSONSchemaMethod = /* @__PURE__ */ __name((schema, processors = {}) => (params) => {
      const ctx = initializeContext({ ...params, processors });
      process2(schema, ctx);
      extractDefs(ctx, schema);
      return finalize(ctx, schema);
    }, "createToJSONSchemaMethod");
    exports2.createToJSONSchemaMethod = createToJSONSchemaMethod;
    var createStandardJSONSchemaMethod = /* @__PURE__ */ __name((schema, io, processors = {}) => (params) => {
      const { libraryOptions, target } = params ?? {};
      const ctx = initializeContext({ ...libraryOptions ?? {}, target, io, processors });
      process2(schema, ctx);
      extractDefs(ctx, schema);
      return finalize(ctx, schema);
    }, "createStandardJSONSchemaMethod");
    exports2.createStandardJSONSchemaMethod = createStandardJSONSchemaMethod;
  }
});

// node_modules/zod/v4/core/json-schema-processors.cjs
var require_json_schema_processors = __commonJS({
  "node_modules/zod/v4/core/json-schema-processors.cjs"(exports2) {
    "use strict";
    Object.defineProperty(exports2, "__esModule", { value: true });
    exports2.allProcessors = exports2.lazyProcessor = exports2.optionalProcessor = exports2.promiseProcessor = exports2.readonlyProcessor = exports2.pipeProcessor = exports2.catchProcessor = exports2.prefaultProcessor = exports2.defaultProcessor = exports2.nonoptionalProcessor = exports2.nullableProcessor = exports2.recordProcessor = exports2.tupleProcessor = exports2.intersectionProcessor = exports2.unionProcessor = exports2.objectProcessor = exports2.arrayProcessor = exports2.setProcessor = exports2.mapProcessor = exports2.transformProcessor = exports2.functionProcessor = exports2.customProcessor = exports2.successProcessor = exports2.fileProcessor = exports2.templateLiteralProcessor = exports2.nanProcessor = exports2.literalProcessor = exports2.enumProcessor = exports2.dateProcessor = exports2.unknownProcessor = exports2.anyProcessor = exports2.neverProcessor = exports2.voidProcessor = exports2.undefinedProcessor = exports2.nullProcessor = exports2.symbolProcessor = exports2.bigintProcessor = exports2.booleanProcessor = exports2.numberProcessor = exports2.stringProcessor = void 0;
    exports2.toJSONSchema = toJSONSchema;
    var to_json_schema_js_1 = require_to_json_schema();
    var util_js_1 = require_util();
    var formatMap = {
      guid: "uuid",
      url: "uri",
      datetime: "date-time",
      json_string: "json-string",
      regex: ""
      // do not set
    };
    var stringProcessor = /* @__PURE__ */ __name((schema, ctx, _json, _params) => {
      const json = _json;
      json.type = "string";
      const { minimum, maximum, format, patterns, contentEncoding } = schema._zod.bag;
      if (typeof minimum === "number")
        json.minLength = minimum;
      if (typeof maximum === "number")
        json.maxLength = maximum;
      if (format) {
        json.format = formatMap[format] ?? format;
        if (json.format === "")
          delete json.format;
        if (format === "time") {
          delete json.format;
        }
      }
      if (contentEncoding)
        json.contentEncoding = contentEncoding;
      if (patterns && patterns.size > 0) {
        const regexes = [...patterns];
        if (regexes.length === 1)
          json.pattern = regexes[0].source;
        else if (regexes.length > 1) {
          json.allOf = [
            ...regexes.map((regex) => ({
              ...ctx.target === "draft-07" || ctx.target === "draft-04" || ctx.target === "openapi-3.0" ? { type: "string" } : {},
              pattern: regex.source
            }))
          ];
        }
      }
    }, "stringProcessor");
    exports2.stringProcessor = stringProcessor;
    var numberProcessor = /* @__PURE__ */ __name((schema, ctx, _json, _params) => {
      const json = _json;
      const { minimum, maximum, format, multipleOf, exclusiveMaximum, exclusiveMinimum } = schema._zod.bag;
      if (typeof format === "string" && format.includes("int"))
        json.type = "integer";
      else
        json.type = "number";
      if (typeof exclusiveMinimum === "number") {
        if (ctx.target === "draft-04" || ctx.target === "openapi-3.0") {
          json.minimum = exclusiveMinimum;
          json.exclusiveMinimum = true;
        } else {
          json.exclusiveMinimum = exclusiveMinimum;
        }
      }
      if (typeof minimum === "number") {
        json.minimum = minimum;
        if (typeof exclusiveMinimum === "number" && ctx.target !== "draft-04") {
          if (exclusiveMinimum >= minimum)
            delete json.minimum;
          else
            delete json.exclusiveMinimum;
        }
      }
      if (typeof exclusiveMaximum === "number") {
        if (ctx.target === "draft-04" || ctx.target === "openapi-3.0") {
          json.maximum = exclusiveMaximum;
          json.exclusiveMaximum = true;
        } else {
          json.exclusiveMaximum = exclusiveMaximum;
        }
      }
      if (typeof maximum === "number") {
        json.maximum = maximum;
        if (typeof exclusiveMaximum === "number" && ctx.target !== "draft-04") {
          if (exclusiveMaximum <= maximum)
            delete json.maximum;
          else
            delete json.exclusiveMaximum;
        }
      }
      if (typeof multipleOf === "number")
        json.multipleOf = multipleOf;
    }, "numberProcessor");
    exports2.numberProcessor = numberProcessor;
    var booleanProcessor = /* @__PURE__ */ __name((_schema, _ctx, json, _params) => {
      json.type = "boolean";
    }, "booleanProcessor");
    exports2.booleanProcessor = booleanProcessor;
    var bigintProcessor = /* @__PURE__ */ __name((_schema, ctx, _json, _params) => {
      if (ctx.unrepresentable === "throw") {
        throw new Error("BigInt cannot be represented in JSON Schema");
      }
    }, "bigintProcessor");
    exports2.bigintProcessor = bigintProcessor;
    var symbolProcessor = /* @__PURE__ */ __name((_schema, ctx, _json, _params) => {
      if (ctx.unrepresentable === "throw") {
        throw new Error("Symbols cannot be represented in JSON Schema");
      }
    }, "symbolProcessor");
    exports2.symbolProcessor = symbolProcessor;
    var nullProcessor = /* @__PURE__ */ __name((_schema, ctx, json, _params) => {
      if (ctx.target === "openapi-3.0") {
        json.type = "string";
        json.nullable = true;
        json.enum = [null];
      } else {
        json.type = "null";
      }
    }, "nullProcessor");
    exports2.nullProcessor = nullProcessor;
    var undefinedProcessor = /* @__PURE__ */ __name((_schema, ctx, _json, _params) => {
      if (ctx.unrepresentable === "throw") {
        throw new Error("Undefined cannot be represented in JSON Schema");
      }
    }, "undefinedProcessor");
    exports2.undefinedProcessor = undefinedProcessor;
    var voidProcessor = /* @__PURE__ */ __name((_schema, ctx, _json, _params) => {
      if (ctx.unrepresentable === "throw") {
        throw new Error("Void cannot be represented in JSON Schema");
      }
    }, "voidProcessor");
    exports2.voidProcessor = voidProcessor;
    var neverProcessor = /* @__PURE__ */ __name((_schema, _ctx, json, _params) => {
      json.not = {};
    }, "neverProcessor");
    exports2.neverProcessor = neverProcessor;
    var anyProcessor = /* @__PURE__ */ __name((_schema, _ctx, _json, _params) => {
    }, "anyProcessor");
    exports2.anyProcessor = anyProcessor;
    var unknownProcessor = /* @__PURE__ */ __name((_schema, _ctx, _json, _params) => {
    }, "unknownProcessor");
    exports2.unknownProcessor = unknownProcessor;
    var dateProcessor = /* @__PURE__ */ __name((_schema, ctx, _json, _params) => {
      if (ctx.unrepresentable === "throw") {
        throw new Error("Date cannot be represented in JSON Schema");
      }
    }, "dateProcessor");
    exports2.dateProcessor = dateProcessor;
    var enumProcessor = /* @__PURE__ */ __name((schema, _ctx, json, _params) => {
      const def = schema._zod.def;
      const values = (0, util_js_1.getEnumValues)(def.entries);
      if (values.every((v) => typeof v === "number"))
        json.type = "number";
      if (values.every((v) => typeof v === "string"))
        json.type = "string";
      json.enum = values;
    }, "enumProcessor");
    exports2.enumProcessor = enumProcessor;
    var literalProcessor = /* @__PURE__ */ __name((schema, ctx, json, _params) => {
      const def = schema._zod.def;
      const vals = [];
      for (const val of def.values) {
        if (val === void 0) {
          if (ctx.unrepresentable === "throw") {
            throw new Error("Literal `undefined` cannot be represented in JSON Schema");
          } else {
          }
        } else if (typeof val === "bigint") {
          if (ctx.unrepresentable === "throw") {
            throw new Error("BigInt literals cannot be represented in JSON Schema");
          } else {
            vals.push(Number(val));
          }
        } else {
          vals.push(val);
        }
      }
      if (vals.length === 0) {
      } else if (vals.length === 1) {
        const val = vals[0];
        json.type = val === null ? "null" : typeof val;
        if (ctx.target === "draft-04" || ctx.target === "openapi-3.0") {
          json.enum = [val];
        } else {
          json.const = val;
        }
      } else {
        if (vals.every((v) => typeof v === "number"))
          json.type = "number";
        if (vals.every((v) => typeof v === "string"))
          json.type = "string";
        if (vals.every((v) => typeof v === "boolean"))
          json.type = "boolean";
        if (vals.every((v) => v === null))
          json.type = "null";
        json.enum = vals;
      }
    }, "literalProcessor");
    exports2.literalProcessor = literalProcessor;
    var nanProcessor = /* @__PURE__ */ __name((_schema, ctx, _json, _params) => {
      if (ctx.unrepresentable === "throw") {
        throw new Error("NaN cannot be represented in JSON Schema");
      }
    }, "nanProcessor");
    exports2.nanProcessor = nanProcessor;
    var templateLiteralProcessor = /* @__PURE__ */ __name((schema, _ctx, json, _params) => {
      const _json = json;
      const pattern = schema._zod.pattern;
      if (!pattern)
        throw new Error("Pattern not found in template literal");
      _json.type = "string";
      _json.pattern = pattern.source;
    }, "templateLiteralProcessor");
    exports2.templateLiteralProcessor = templateLiteralProcessor;
    var fileProcessor = /* @__PURE__ */ __name((schema, _ctx, json, _params) => {
      const _json = json;
      const file = {
        type: "string",
        format: "binary",
        contentEncoding: "binary"
      };
      const { minimum, maximum, mime } = schema._zod.bag;
      if (minimum !== void 0)
        file.minLength = minimum;
      if (maximum !== void 0)
        file.maxLength = maximum;
      if (mime) {
        if (mime.length === 1) {
          file.contentMediaType = mime[0];
          Object.assign(_json, file);
        } else {
          Object.assign(_json, file);
          _json.anyOf = mime.map((m) => ({ contentMediaType: m }));
        }
      } else {
        Object.assign(_json, file);
      }
    }, "fileProcessor");
    exports2.fileProcessor = fileProcessor;
    var successProcessor = /* @__PURE__ */ __name((_schema, _ctx, json, _params) => {
      json.type = "boolean";
    }, "successProcessor");
    exports2.successProcessor = successProcessor;
    var customProcessor = /* @__PURE__ */ __name((_schema, ctx, _json, _params) => {
      if (ctx.unrepresentable === "throw") {
        throw new Error("Custom types cannot be represented in JSON Schema");
      }
    }, "customProcessor");
    exports2.customProcessor = customProcessor;
    var functionProcessor = /* @__PURE__ */ __name((_schema, ctx, _json, _params) => {
      if (ctx.unrepresentable === "throw") {
        throw new Error("Function types cannot be represented in JSON Schema");
      }
    }, "functionProcessor");
    exports2.functionProcessor = functionProcessor;
    var transformProcessor = /* @__PURE__ */ __name((_schema, ctx, _json, _params) => {
      if (ctx.unrepresentable === "throw") {
        throw new Error("Transforms cannot be represented in JSON Schema");
      }
    }, "transformProcessor");
    exports2.transformProcessor = transformProcessor;
    var mapProcessor = /* @__PURE__ */ __name((_schema, ctx, _json, _params) => {
      if (ctx.unrepresentable === "throw") {
        throw new Error("Map cannot be represented in JSON Schema");
      }
    }, "mapProcessor");
    exports2.mapProcessor = mapProcessor;
    var setProcessor = /* @__PURE__ */ __name((_schema, ctx, _json, _params) => {
      if (ctx.unrepresentable === "throw") {
        throw new Error("Set cannot be represented in JSON Schema");
      }
    }, "setProcessor");
    exports2.setProcessor = setProcessor;
    var arrayProcessor = /* @__PURE__ */ __name((schema, ctx, _json, params) => {
      const json = _json;
      const def = schema._zod.def;
      const { minimum, maximum } = schema._zod.bag;
      if (typeof minimum === "number")
        json.minItems = minimum;
      if (typeof maximum === "number")
        json.maxItems = maximum;
      json.type = "array";
      json.items = (0, to_json_schema_js_1.process)(def.element, ctx, { ...params, path: [...params.path, "items"] });
    }, "arrayProcessor");
    exports2.arrayProcessor = arrayProcessor;
    var objectProcessor = /* @__PURE__ */ __name((schema, ctx, _json, params) => {
      const json = _json;
      const def = schema._zod.def;
      json.type = "object";
      json.properties = {};
      const shape = def.shape;
      for (const key in shape) {
        json.properties[key] = (0, to_json_schema_js_1.process)(shape[key], ctx, {
          ...params,
          path: [...params.path, "properties", key]
        });
      }
      const allKeys = new Set(Object.keys(shape));
      const requiredKeys = new Set([...allKeys].filter((key) => {
        const v = def.shape[key]._zod;
        if (ctx.io === "input") {
          return v.optin === void 0;
        } else {
          return v.optout === void 0;
        }
      }));
      if (requiredKeys.size > 0) {
        json.required = Array.from(requiredKeys);
      }
      if (def.catchall?._zod.def.type === "never") {
        json.additionalProperties = false;
      } else if (!def.catchall) {
        if (ctx.io === "output")
          json.additionalProperties = false;
      } else if (def.catchall) {
        json.additionalProperties = (0, to_json_schema_js_1.process)(def.catchall, ctx, {
          ...params,
          path: [...params.path, "additionalProperties"]
        });
      }
    }, "objectProcessor");
    exports2.objectProcessor = objectProcessor;
    var unionProcessor = /* @__PURE__ */ __name((schema, ctx, json, params) => {
      const def = schema._zod.def;
      const isExclusive = def.inclusive === false;
      const options = def.options.map((x, i) => (0, to_json_schema_js_1.process)(x, ctx, {
        ...params,
        path: [...params.path, isExclusive ? "oneOf" : "anyOf", i]
      }));
      if (isExclusive) {
        json.oneOf = options;
      } else {
        json.anyOf = options;
      }
    }, "unionProcessor");
    exports2.unionProcessor = unionProcessor;
    var intersectionProcessor = /* @__PURE__ */ __name((schema, ctx, json, params) => {
      const def = schema._zod.def;
      const a = (0, to_json_schema_js_1.process)(def.left, ctx, {
        ...params,
        path: [...params.path, "allOf", 0]
      });
      const b = (0, to_json_schema_js_1.process)(def.right, ctx, {
        ...params,
        path: [...params.path, "allOf", 1]
      });
      const isSimpleIntersection = /* @__PURE__ */ __name((val) => "allOf" in val && Object.keys(val).length === 1, "isSimpleIntersection");
      const allOf = [
        ...isSimpleIntersection(a) ? a.allOf : [a],
        ...isSimpleIntersection(b) ? b.allOf : [b]
      ];
      json.allOf = allOf;
    }, "intersectionProcessor");
    exports2.intersectionProcessor = intersectionProcessor;
    var tupleProcessor = /* @__PURE__ */ __name((schema, ctx, _json, params) => {
      const json = _json;
      const def = schema._zod.def;
      json.type = "array";
      const prefixPath = ctx.target === "draft-2020-12" ? "prefixItems" : "items";
      const restPath = ctx.target === "draft-2020-12" ? "items" : ctx.target === "openapi-3.0" ? "items" : "additionalItems";
      const prefixItems = def.items.map((x, i) => (0, to_json_schema_js_1.process)(x, ctx, {
        ...params,
        path: [...params.path, prefixPath, i]
      }));
      const rest = def.rest ? (0, to_json_schema_js_1.process)(def.rest, ctx, {
        ...params,
        path: [...params.path, restPath, ...ctx.target === "openapi-3.0" ? [def.items.length] : []]
      }) : null;
      if (ctx.target === "draft-2020-12") {
        json.prefixItems = prefixItems;
        if (rest) {
          json.items = rest;
        }
      } else if (ctx.target === "openapi-3.0") {
        json.items = {
          anyOf: prefixItems
        };
        if (rest) {
          json.items.anyOf.push(rest);
        }
        json.minItems = prefixItems.length;
        if (!rest) {
          json.maxItems = prefixItems.length;
        }
      } else {
        json.items = prefixItems;
        if (rest) {
          json.additionalItems = rest;
        }
      }
      const { minimum, maximum } = schema._zod.bag;
      if (typeof minimum === "number")
        json.minItems = minimum;
      if (typeof maximum === "number")
        json.maxItems = maximum;
    }, "tupleProcessor");
    exports2.tupleProcessor = tupleProcessor;
    var recordProcessor = /* @__PURE__ */ __name((schema, ctx, _json, params) => {
      const json = _json;
      const def = schema._zod.def;
      json.type = "object";
      const keyType = def.keyType;
      const keyBag = keyType._zod.bag;
      const patterns = keyBag?.patterns;
      if (def.mode === "loose" && patterns && patterns.size > 0) {
        const valueSchema = (0, to_json_schema_js_1.process)(def.valueType, ctx, {
          ...params,
          path: [...params.path, "patternProperties", "*"]
        });
        json.patternProperties = {};
        for (const pattern of patterns) {
          json.patternProperties[pattern.source] = valueSchema;
        }
      } else {
        if (ctx.target === "draft-07" || ctx.target === "draft-2020-12") {
          json.propertyNames = (0, to_json_schema_js_1.process)(def.keyType, ctx, {
            ...params,
            path: [...params.path, "propertyNames"]
          });
        }
        json.additionalProperties = (0, to_json_schema_js_1.process)(def.valueType, ctx, {
          ...params,
          path: [...params.path, "additionalProperties"]
        });
      }
      const keyValues = keyType._zod.values;
      if (keyValues) {
        const validKeyValues = [...keyValues].filter((v) => typeof v === "string" || typeof v === "number");
        if (validKeyValues.length > 0) {
          json.required = validKeyValues;
        }
      }
    }, "recordProcessor");
    exports2.recordProcessor = recordProcessor;
    var nullableProcessor = /* @__PURE__ */ __name((schema, ctx, json, params) => {
      const def = schema._zod.def;
      const inner = (0, to_json_schema_js_1.process)(def.innerType, ctx, params);
      const seen = ctx.seen.get(schema);
      if (ctx.target === "openapi-3.0") {
        seen.ref = def.innerType;
        json.nullable = true;
      } else {
        json.anyOf = [inner, { type: "null" }];
      }
    }, "nullableProcessor");
    exports2.nullableProcessor = nullableProcessor;
    var nonoptionalProcessor = /* @__PURE__ */ __name((schema, ctx, _json, params) => {
      const def = schema._zod.def;
      (0, to_json_schema_js_1.process)(def.innerType, ctx, params);
      const seen = ctx.seen.get(schema);
      seen.ref = def.innerType;
    }, "nonoptionalProcessor");
    exports2.nonoptionalProcessor = nonoptionalProcessor;
    var defaultProcessor = /* @__PURE__ */ __name((schema, ctx, json, params) => {
      const def = schema._zod.def;
      (0, to_json_schema_js_1.process)(def.innerType, ctx, params);
      const seen = ctx.seen.get(schema);
      seen.ref = def.innerType;
      json.default = JSON.parse(JSON.stringify(def.defaultValue));
    }, "defaultProcessor");
    exports2.defaultProcessor = defaultProcessor;
    var prefaultProcessor = /* @__PURE__ */ __name((schema, ctx, json, params) => {
      const def = schema._zod.def;
      (0, to_json_schema_js_1.process)(def.innerType, ctx, params);
      const seen = ctx.seen.get(schema);
      seen.ref = def.innerType;
      if (ctx.io === "input")
        json._prefault = JSON.parse(JSON.stringify(def.defaultValue));
    }, "prefaultProcessor");
    exports2.prefaultProcessor = prefaultProcessor;
    var catchProcessor = /* @__PURE__ */ __name((schema, ctx, json, params) => {
      const def = schema._zod.def;
      (0, to_json_schema_js_1.process)(def.innerType, ctx, params);
      const seen = ctx.seen.get(schema);
      seen.ref = def.innerType;
      let catchValue;
      try {
        catchValue = def.catchValue(void 0);
      } catch {
        throw new Error("Dynamic catch values are not supported in JSON Schema");
      }
      json.default = catchValue;
    }, "catchProcessor");
    exports2.catchProcessor = catchProcessor;
    var pipeProcessor = /* @__PURE__ */ __name((schema, ctx, _json, params) => {
      const def = schema._zod.def;
      const innerType = ctx.io === "input" ? def.in._zod.def.type === "transform" ? def.out : def.in : def.out;
      (0, to_json_schema_js_1.process)(innerType, ctx, params);
      const seen = ctx.seen.get(schema);
      seen.ref = innerType;
    }, "pipeProcessor");
    exports2.pipeProcessor = pipeProcessor;
    var readonlyProcessor = /* @__PURE__ */ __name((schema, ctx, json, params) => {
      const def = schema._zod.def;
      (0, to_json_schema_js_1.process)(def.innerType, ctx, params);
      const seen = ctx.seen.get(schema);
      seen.ref = def.innerType;
      json.readOnly = true;
    }, "readonlyProcessor");
    exports2.readonlyProcessor = readonlyProcessor;
    var promiseProcessor = /* @__PURE__ */ __name((schema, ctx, _json, params) => {
      const def = schema._zod.def;
      (0, to_json_schema_js_1.process)(def.innerType, ctx, params);
      const seen = ctx.seen.get(schema);
      seen.ref = def.innerType;
    }, "promiseProcessor");
    exports2.promiseProcessor = promiseProcessor;
    var optionalProcessor = /* @__PURE__ */ __name((schema, ctx, _json, params) => {
      const def = schema._zod.def;
      (0, to_json_schema_js_1.process)(def.innerType, ctx, params);
      const seen = ctx.seen.get(schema);
      seen.ref = def.innerType;
    }, "optionalProcessor");
    exports2.optionalProcessor = optionalProcessor;
    var lazyProcessor = /* @__PURE__ */ __name((schema, ctx, _json, params) => {
      const innerType = schema._zod.innerType;
      (0, to_json_schema_js_1.process)(innerType, ctx, params);
      const seen = ctx.seen.get(schema);
      seen.ref = innerType;
    }, "lazyProcessor");
    exports2.lazyProcessor = lazyProcessor;
    exports2.allProcessors = {
      string: exports2.stringProcessor,
      number: exports2.numberProcessor,
      boolean: exports2.booleanProcessor,
      bigint: exports2.bigintProcessor,
      symbol: exports2.symbolProcessor,
      null: exports2.nullProcessor,
      undefined: exports2.undefinedProcessor,
      void: exports2.voidProcessor,
      never: exports2.neverProcessor,
      any: exports2.anyProcessor,
      unknown: exports2.unknownProcessor,
      date: exports2.dateProcessor,
      enum: exports2.enumProcessor,
      literal: exports2.literalProcessor,
      nan: exports2.nanProcessor,
      template_literal: exports2.templateLiteralProcessor,
      file: exports2.fileProcessor,
      success: exports2.successProcessor,
      custom: exports2.customProcessor,
      function: exports2.functionProcessor,
      transform: exports2.transformProcessor,
      map: exports2.mapProcessor,
      set: exports2.setProcessor,
      array: exports2.arrayProcessor,
      object: exports2.objectProcessor,
      union: exports2.unionProcessor,
      intersection: exports2.intersectionProcessor,
      tuple: exports2.tupleProcessor,
      record: exports2.recordProcessor,
      nullable: exports2.nullableProcessor,
      nonoptional: exports2.nonoptionalProcessor,
      default: exports2.defaultProcessor,
      prefault: exports2.prefaultProcessor,
      catch: exports2.catchProcessor,
      pipe: exports2.pipeProcessor,
      readonly: exports2.readonlyProcessor,
      promise: exports2.promiseProcessor,
      optional: exports2.optionalProcessor,
      lazy: exports2.lazyProcessor
    };
    function toJSONSchema(input, params) {
      if ("_idmap" in input) {
        const registry = input;
        const ctx2 = (0, to_json_schema_js_1.initializeContext)({ ...params, processors: exports2.allProcessors });
        const defs = {};
        for (const entry of registry._idmap.entries()) {
          const [_, schema] = entry;
          (0, to_json_schema_js_1.process)(schema, ctx2);
        }
        const schemas = {};
        const external = {
          registry,
          uri: params?.uri,
          defs
        };
        ctx2.external = external;
        for (const entry of registry._idmap.entries()) {
          const [key, schema] = entry;
          (0, to_json_schema_js_1.extractDefs)(ctx2, schema);
          schemas[key] = (0, to_json_schema_js_1.finalize)(ctx2, schema);
        }
        if (Object.keys(defs).length > 0) {
          const defsSegment = ctx2.target === "draft-2020-12" ? "$defs" : "definitions";
          schemas.__shared = {
            [defsSegment]: defs
          };
        }
        return { schemas };
      }
      const ctx = (0, to_json_schema_js_1.initializeContext)({ ...params, processors: exports2.allProcessors });
      (0, to_json_schema_js_1.process)(input, ctx);
      (0, to_json_schema_js_1.extractDefs)(ctx, input);
      return (0, to_json_schema_js_1.finalize)(ctx, input);
    }
    __name(toJSONSchema, "toJSONSchema");
  }
});

// node_modules/zod/v4/core/json-schema-generator.cjs
var require_json_schema_generator = __commonJS({
  "node_modules/zod/v4/core/json-schema-generator.cjs"(exports2) {
    "use strict";
    Object.defineProperty(exports2, "__esModule", { value: true });
    exports2.JSONSchemaGenerator = void 0;
    var json_schema_processors_js_1 = require_json_schema_processors();
    var to_json_schema_js_1 = require_to_json_schema();
    var JSONSchemaGenerator = class {
      static {
        __name(this, "JSONSchemaGenerator");
      }
      /** @deprecated Access via ctx instead */
      get metadataRegistry() {
        return this.ctx.metadataRegistry;
      }
      /** @deprecated Access via ctx instead */
      get target() {
        return this.ctx.target;
      }
      /** @deprecated Access via ctx instead */
      get unrepresentable() {
        return this.ctx.unrepresentable;
      }
      /** @deprecated Access via ctx instead */
      get override() {
        return this.ctx.override;
      }
      /** @deprecated Access via ctx instead */
      get io() {
        return this.ctx.io;
      }
      /** @deprecated Access via ctx instead */
      get counter() {
        return this.ctx.counter;
      }
      set counter(value) {
        this.ctx.counter = value;
      }
      /** @deprecated Access via ctx instead */
      get seen() {
        return this.ctx.seen;
      }
      constructor(params) {
        let normalizedTarget = params?.target ?? "draft-2020-12";
        if (normalizedTarget === "draft-4")
          normalizedTarget = "draft-04";
        if (normalizedTarget === "draft-7")
          normalizedTarget = "draft-07";
        this.ctx = (0, to_json_schema_js_1.initializeContext)({
          processors: json_schema_processors_js_1.allProcessors,
          target: normalizedTarget,
          ...params?.metadata && { metadata: params.metadata },
          ...params?.unrepresentable && { unrepresentable: params.unrepresentable },
          ...params?.override && { override: params.override },
          ...params?.io && { io: params.io }
        });
      }
      /**
       * Process a schema to prepare it for JSON Schema generation.
       * This must be called before emit().
       */
      process(schema, _params = { path: [], schemaPath: [] }) {
        return (0, to_json_schema_js_1.process)(schema, this.ctx, _params);
      }
      /**
       * Emit the final JSON Schema after processing.
       * Must call process() first.
       */
      emit(schema, _params) {
        if (_params) {
          if (_params.cycles)
            this.ctx.cycles = _params.cycles;
          if (_params.reused)
            this.ctx.reused = _params.reused;
          if (_params.external)
            this.ctx.external = _params.external;
        }
        (0, to_json_schema_js_1.extractDefs)(this.ctx, schema);
        const result = (0, to_json_schema_js_1.finalize)(this.ctx, schema);
        const { "~standard": _, ...plainResult } = result;
        return plainResult;
      }
    };
    exports2.JSONSchemaGenerator = JSONSchemaGenerator;
  }
});

// node_modules/zod/v4/core/json-schema.cjs
var require_json_schema = __commonJS({
  "node_modules/zod/v4/core/json-schema.cjs"(exports2) {
    "use strict";
    Object.defineProperty(exports2, "__esModule", { value: true });
  }
});

// node_modules/zod/v4/core/index.cjs
var require_core2 = __commonJS({
  "node_modules/zod/v4/core/index.cjs"(exports2) {
    "use strict";
    var __createBinding = exports2 && exports2.__createBinding || (Object.create ? (function(o, m, k, k2) {
      if (k2 === void 0) k2 = k;
      var desc = Object.getOwnPropertyDescriptor(m, k);
      if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
        desc = { enumerable: true, get: /* @__PURE__ */ __name(function() {
          return m[k];
        }, "get") };
      }
      Object.defineProperty(o, k2, desc);
    }) : (function(o, m, k, k2) {
      if (k2 === void 0) k2 = k;
      o[k2] = m[k];
    }));
    var __setModuleDefault = exports2 && exports2.__setModuleDefault || (Object.create ? (function(o, v) {
      Object.defineProperty(o, "default", { enumerable: true, value: v });
    }) : function(o, v) {
      o["default"] = v;
    });
    var __exportStar = exports2 && exports2.__exportStar || function(m, exports3) {
      for (var p in m) if (p !== "default" && !Object.prototype.hasOwnProperty.call(exports3, p)) __createBinding(exports3, m, p);
    };
    var __importStar = exports2 && exports2.__importStar || function(mod) {
      if (mod && mod.__esModule) return mod;
      var result = {};
      if (mod != null) {
        for (var k in mod) if (k !== "default" && Object.prototype.hasOwnProperty.call(mod, k)) __createBinding(result, mod, k);
      }
      __setModuleDefault(result, mod);
      return result;
    };
    Object.defineProperty(exports2, "__esModule", { value: true });
    exports2.JSONSchema = exports2.JSONSchemaGenerator = exports2.toJSONSchema = exports2.locales = exports2.regexes = exports2.util = void 0;
    __exportStar(require_core(), exports2);
    __exportStar(require_parse(), exports2);
    __exportStar(require_errors2(), exports2);
    __exportStar(require_schemas(), exports2);
    __exportStar(require_checks(), exports2);
    __exportStar(require_versions(), exports2);
    exports2.util = __importStar(require_util());
    exports2.regexes = __importStar(require_regexes());
    exports2.locales = __importStar(require_locales());
    __exportStar(require_registries(), exports2);
    __exportStar(require_doc(), exports2);
    __exportStar(require_api(), exports2);
    __exportStar(require_to_json_schema(), exports2);
    var json_schema_processors_js_1 = require_json_schema_processors();
    Object.defineProperty(exports2, "toJSONSchema", { enumerable: true, get: /* @__PURE__ */ __name(function() {
      return json_schema_processors_js_1.toJSONSchema;
    }, "get") });
    var json_schema_generator_js_1 = require_json_schema_generator();
    Object.defineProperty(exports2, "JSONSchemaGenerator", { enumerable: true, get: /* @__PURE__ */ __name(function() {
      return json_schema_generator_js_1.JSONSchemaGenerator;
    }, "get") });
    exports2.JSONSchema = __importStar(require_json_schema());
  }
});

// node_modules/zod/v4/classic/checks.cjs
var require_checks2 = __commonJS({
  "node_modules/zod/v4/classic/checks.cjs"(exports2) {
    "use strict";
    Object.defineProperty(exports2, "__esModule", { value: true });
    exports2.slugify = exports2.toUpperCase = exports2.toLowerCase = exports2.trim = exports2.normalize = exports2.overwrite = exports2.mime = exports2.property = exports2.endsWith = exports2.startsWith = exports2.includes = exports2.uppercase = exports2.lowercase = exports2.regex = exports2.length = exports2.minLength = exports2.maxLength = exports2.size = exports2.minSize = exports2.maxSize = exports2.multipleOf = exports2.nonnegative = exports2.nonpositive = exports2.negative = exports2.positive = exports2.gte = exports2.gt = exports2.lte = exports2.lt = void 0;
    var index_js_1 = require_core2();
    Object.defineProperty(exports2, "lt", { enumerable: true, get: /* @__PURE__ */ __name(function() {
      return index_js_1._lt;
    }, "get") });
    Object.defineProperty(exports2, "lte", { enumerable: true, get: /* @__PURE__ */ __name(function() {
      return index_js_1._lte;
    }, "get") });
    Object.defineProperty(exports2, "gt", { enumerable: true, get: /* @__PURE__ */ __name(function() {
      return index_js_1._gt;
    }, "get") });
    Object.defineProperty(exports2, "gte", { enumerable: true, get: /* @__PURE__ */ __name(function() {
      return index_js_1._gte;
    }, "get") });
    Object.defineProperty(exports2, "positive", { enumerable: true, get: /* @__PURE__ */ __name(function() {
      return index_js_1._positive;
    }, "get") });
    Object.defineProperty(exports2, "negative", { enumerable: true, get: /* @__PURE__ */ __name(function() {
      return index_js_1._negative;
    }, "get") });
    Object.defineProperty(exports2, "nonpositive", { enumerable: true, get: /* @__PURE__ */ __name(function() {
      return index_js_1._nonpositive;
    }, "get") });
    Object.defineProperty(exports2, "nonnegative", { enumerable: true, get: /* @__PURE__ */ __name(function() {
      return index_js_1._nonnegative;
    }, "get") });
    Object.defineProperty(exports2, "multipleOf", { enumerable: true, get: /* @__PURE__ */ __name(function() {
      return index_js_1._multipleOf;
    }, "get") });
    Object.defineProperty(exports2, "maxSize", { enumerable: true, get: /* @__PURE__ */ __name(function() {
      return index_js_1._maxSize;
    }, "get") });
    Object.defineProperty(exports2, "minSize", { enumerable: true, get: /* @__PURE__ */ __name(function() {
      return index_js_1._minSize;
    }, "get") });
    Object.defineProperty(exports2, "size", { enumerable: true, get: /* @__PURE__ */ __name(function() {
      return index_js_1._size;
    }, "get") });
    Object.defineProperty(exports2, "maxLength", { enumerable: true, get: /* @__PURE__ */ __name(function() {
      return index_js_1._maxLength;
    }, "get") });
    Object.defineProperty(exports2, "minLength", { enumerable: true, get: /* @__PURE__ */ __name(function() {
      return index_js_1._minLength;
    }, "get") });
    Object.defineProperty(exports2, "length", { enumerable: true, get: /* @__PURE__ */ __name(function() {
      return index_js_1._length;
    }, "get") });
    Object.defineProperty(exports2, "regex", { enumerable: true, get: /* @__PURE__ */ __name(function() {
      return index_js_1._regex;
    }, "get") });
    Object.defineProperty(exports2, "lowercase", { enumerable: true, get: /* @__PURE__ */ __name(function() {
      return index_js_1._lowercase;
    }, "get") });
    Object.defineProperty(exports2, "uppercase", { enumerable: true, get: /* @__PURE__ */ __name(function() {
      return index_js_1._uppercase;
    }, "get") });
    Object.defineProperty(exports2, "includes", { enumerable: true, get: /* @__PURE__ */ __name(function() {
      return index_js_1._includes;
    }, "get") });
    Object.defineProperty(exports2, "startsWith", { enumerable: true, get: /* @__PURE__ */ __name(function() {
      return index_js_1._startsWith;
    }, "get") });
    Object.defineProperty(exports2, "endsWith", { enumerable: true, get: /* @__PURE__ */ __name(function() {
      return index_js_1._endsWith;
    }, "get") });
    Object.defineProperty(exports2, "property", { enumerable: true, get: /* @__PURE__ */ __name(function() {
      return index_js_1._property;
    }, "get") });
    Object.defineProperty(exports2, "mime", { enumerable: true, get: /* @__PURE__ */ __name(function() {
      return index_js_1._mime;
    }, "get") });
    Object.defineProperty(exports2, "overwrite", { enumerable: true, get: /* @__PURE__ */ __name(function() {
      return index_js_1._overwrite;
    }, "get") });
    Object.defineProperty(exports2, "normalize", { enumerable: true, get: /* @__PURE__ */ __name(function() {
      return index_js_1._normalize;
    }, "get") });
    Object.defineProperty(exports2, "trim", { enumerable: true, get: /* @__PURE__ */ __name(function() {
      return index_js_1._trim;
    }, "get") });
    Object.defineProperty(exports2, "toLowerCase", { enumerable: true, get: /* @__PURE__ */ __name(function() {
      return index_js_1._toLowerCase;
    }, "get") });
    Object.defineProperty(exports2, "toUpperCase", { enumerable: true, get: /* @__PURE__ */ __name(function() {
      return index_js_1._toUpperCase;
    }, "get") });
    Object.defineProperty(exports2, "slugify", { enumerable: true, get: /* @__PURE__ */ __name(function() {
      return index_js_1._slugify;
    }, "get") });
  }
});

// node_modules/zod/v4/classic/iso.cjs
var require_iso = __commonJS({
  "node_modules/zod/v4/classic/iso.cjs"(exports2) {
    "use strict";
    var __createBinding = exports2 && exports2.__createBinding || (Object.create ? (function(o, m, k, k2) {
      if (k2 === void 0) k2 = k;
      var desc = Object.getOwnPropertyDescriptor(m, k);
      if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
        desc = { enumerable: true, get: /* @__PURE__ */ __name(function() {
          return m[k];
        }, "get") };
      }
      Object.defineProperty(o, k2, desc);
    }) : (function(o, m, k, k2) {
      if (k2 === void 0) k2 = k;
      o[k2] = m[k];
    }));
    var __setModuleDefault = exports2 && exports2.__setModuleDefault || (Object.create ? (function(o, v) {
      Object.defineProperty(o, "default", { enumerable: true, value: v });
    }) : function(o, v) {
      o["default"] = v;
    });
    var __importStar = exports2 && exports2.__importStar || function(mod) {
      if (mod && mod.__esModule) return mod;
      var result = {};
      if (mod != null) {
        for (var k in mod) if (k !== "default" && Object.prototype.hasOwnProperty.call(mod, k)) __createBinding(result, mod, k);
      }
      __setModuleDefault(result, mod);
      return result;
    };
    Object.defineProperty(exports2, "__esModule", { value: true });
    exports2.ZodISODuration = exports2.ZodISOTime = exports2.ZodISODate = exports2.ZodISODateTime = void 0;
    exports2.datetime = datetime;
    exports2.date = date;
    exports2.time = time;
    exports2.duration = duration;
    var core = __importStar(require_core2());
    var schemas = __importStar(require_schemas2());
    exports2.ZodISODateTime = core.$constructor("ZodISODateTime", (inst, def) => {
      core.$ZodISODateTime.init(inst, def);
      schemas.ZodStringFormat.init(inst, def);
    });
    function datetime(params) {
      return core._isoDateTime(exports2.ZodISODateTime, params);
    }
    __name(datetime, "datetime");
    exports2.ZodISODate = core.$constructor("ZodISODate", (inst, def) => {
      core.$ZodISODate.init(inst, def);
      schemas.ZodStringFormat.init(inst, def);
    });
    function date(params) {
      return core._isoDate(exports2.ZodISODate, params);
    }
    __name(date, "date");
    exports2.ZodISOTime = core.$constructor("ZodISOTime", (inst, def) => {
      core.$ZodISOTime.init(inst, def);
      schemas.ZodStringFormat.init(inst, def);
    });
    function time(params) {
      return core._isoTime(exports2.ZodISOTime, params);
    }
    __name(time, "time");
    exports2.ZodISODuration = core.$constructor("ZodISODuration", (inst, def) => {
      core.$ZodISODuration.init(inst, def);
      schemas.ZodStringFormat.init(inst, def);
    });
    function duration(params) {
      return core._isoDuration(exports2.ZodISODuration, params);
    }
    __name(duration, "duration");
  }
});

// node_modules/zod/v4/classic/errors.cjs
var require_errors3 = __commonJS({
  "node_modules/zod/v4/classic/errors.cjs"(exports2) {
    "use strict";
    var __createBinding = exports2 && exports2.__createBinding || (Object.create ? (function(o, m, k, k2) {
      if (k2 === void 0) k2 = k;
      var desc = Object.getOwnPropertyDescriptor(m, k);
      if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
        desc = { enumerable: true, get: /* @__PURE__ */ __name(function() {
          return m[k];
        }, "get") };
      }
      Object.defineProperty(o, k2, desc);
    }) : (function(o, m, k, k2) {
      if (k2 === void 0) k2 = k;
      o[k2] = m[k];
    }));
    var __setModuleDefault = exports2 && exports2.__setModuleDefault || (Object.create ? (function(o, v) {
      Object.defineProperty(o, "default", { enumerable: true, value: v });
    }) : function(o, v) {
      o["default"] = v;
    });
    var __importStar = exports2 && exports2.__importStar || function(mod) {
      if (mod && mod.__esModule) return mod;
      var result = {};
      if (mod != null) {
        for (var k in mod) if (k !== "default" && Object.prototype.hasOwnProperty.call(mod, k)) __createBinding(result, mod, k);
      }
      __setModuleDefault(result, mod);
      return result;
    };
    Object.defineProperty(exports2, "__esModule", { value: true });
    exports2.ZodRealError = exports2.ZodError = void 0;
    var core = __importStar(require_core2());
    var index_js_1 = require_core2();
    var util = __importStar(require_util());
    var initializer = /* @__PURE__ */ __name((inst, issues) => {
      index_js_1.$ZodError.init(inst, issues);
      inst.name = "ZodError";
      Object.defineProperties(inst, {
        format: {
          value: /* @__PURE__ */ __name((mapper) => core.formatError(inst, mapper), "value")
          // enumerable: false,
        },
        flatten: {
          value: /* @__PURE__ */ __name((mapper) => core.flattenError(inst, mapper), "value")
          // enumerable: false,
        },
        addIssue: {
          value: /* @__PURE__ */ __name((issue) => {
            inst.issues.push(issue);
            inst.message = JSON.stringify(inst.issues, util.jsonStringifyReplacer, 2);
          }, "value")
          // enumerable: false,
        },
        addIssues: {
          value: /* @__PURE__ */ __name((issues2) => {
            inst.issues.push(...issues2);
            inst.message = JSON.stringify(inst.issues, util.jsonStringifyReplacer, 2);
          }, "value")
          // enumerable: false,
        },
        isEmpty: {
          get() {
            return inst.issues.length === 0;
          }
          // enumerable: false,
        }
      });
    }, "initializer");
    exports2.ZodError = core.$constructor("ZodError", initializer);
    exports2.ZodRealError = core.$constructor("ZodError", initializer, {
      Parent: Error
    });
  }
});

// node_modules/zod/v4/classic/parse.cjs
var require_parse2 = __commonJS({
  "node_modules/zod/v4/classic/parse.cjs"(exports2) {
    "use strict";
    var __createBinding = exports2 && exports2.__createBinding || (Object.create ? (function(o, m, k, k2) {
      if (k2 === void 0) k2 = k;
      var desc = Object.getOwnPropertyDescriptor(m, k);
      if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
        desc = { enumerable: true, get: /* @__PURE__ */ __name(function() {
          return m[k];
        }, "get") };
      }
      Object.defineProperty(o, k2, desc);
    }) : (function(o, m, k, k2) {
      if (k2 === void 0) k2 = k;
      o[k2] = m[k];
    }));
    var __setModuleDefault = exports2 && exports2.__setModuleDefault || (Object.create ? (function(o, v) {
      Object.defineProperty(o, "default", { enumerable: true, value: v });
    }) : function(o, v) {
      o["default"] = v;
    });
    var __importStar = exports2 && exports2.__importStar || function(mod) {
      if (mod && mod.__esModule) return mod;
      var result = {};
      if (mod != null) {
        for (var k in mod) if (k !== "default" && Object.prototype.hasOwnProperty.call(mod, k)) __createBinding(result, mod, k);
      }
      __setModuleDefault(result, mod);
      return result;
    };
    Object.defineProperty(exports2, "__esModule", { value: true });
    exports2.safeDecodeAsync = exports2.safeEncodeAsync = exports2.safeDecode = exports2.safeEncode = exports2.decodeAsync = exports2.encodeAsync = exports2.decode = exports2.encode = exports2.safeParseAsync = exports2.safeParse = exports2.parseAsync = exports2.parse = void 0;
    var core = __importStar(require_core2());
    var errors_js_1 = require_errors3();
    exports2.parse = core._parse(errors_js_1.ZodRealError);
    exports2.parseAsync = core._parseAsync(errors_js_1.ZodRealError);
    exports2.safeParse = core._safeParse(errors_js_1.ZodRealError);
    exports2.safeParseAsync = core._safeParseAsync(errors_js_1.ZodRealError);
    exports2.encode = core._encode(errors_js_1.ZodRealError);
    exports2.decode = core._decode(errors_js_1.ZodRealError);
    exports2.encodeAsync = core._encodeAsync(errors_js_1.ZodRealError);
    exports2.decodeAsync = core._decodeAsync(errors_js_1.ZodRealError);
    exports2.safeEncode = core._safeEncode(errors_js_1.ZodRealError);
    exports2.safeDecode = core._safeDecode(errors_js_1.ZodRealError);
    exports2.safeEncodeAsync = core._safeEncodeAsync(errors_js_1.ZodRealError);
    exports2.safeDecodeAsync = core._safeDecodeAsync(errors_js_1.ZodRealError);
  }
});

// node_modules/zod/v4/classic/schemas.cjs
var require_schemas2 = __commonJS({
  "node_modules/zod/v4/classic/schemas.cjs"(exports2) {
    "use strict";
    var __createBinding = exports2 && exports2.__createBinding || (Object.create ? (function(o, m, k, k2) {
      if (k2 === void 0) k2 = k;
      var desc = Object.getOwnPropertyDescriptor(m, k);
      if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
        desc = { enumerable: true, get: /* @__PURE__ */ __name(function() {
          return m[k];
        }, "get") };
      }
      Object.defineProperty(o, k2, desc);
    }) : (function(o, m, k, k2) {
      if (k2 === void 0) k2 = k;
      o[k2] = m[k];
    }));
    var __setModuleDefault = exports2 && exports2.__setModuleDefault || (Object.create ? (function(o, v) {
      Object.defineProperty(o, "default", { enumerable: true, value: v });
    }) : function(o, v) {
      o["default"] = v;
    });
    var __importStar = exports2 && exports2.__importStar || function(mod) {
      if (mod && mod.__esModule) return mod;
      var result = {};
      if (mod != null) {
        for (var k in mod) if (k !== "default" && Object.prototype.hasOwnProperty.call(mod, k)) __createBinding(result, mod, k);
      }
      __setModuleDefault(result, mod);
      return result;
    };
    Object.defineProperty(exports2, "__esModule", { value: true });
    exports2.ZodLiteral = exports2.ZodEnum = exports2.ZodSet = exports2.ZodMap = exports2.ZodRecord = exports2.ZodTuple = exports2.ZodIntersection = exports2.ZodDiscriminatedUnion = exports2.ZodXor = exports2.ZodUnion = exports2.ZodObject = exports2.ZodArray = exports2.ZodDate = exports2.ZodVoid = exports2.ZodNever = exports2.ZodUnknown = exports2.ZodAny = exports2.ZodNull = exports2.ZodUndefined = exports2.ZodSymbol = exports2.ZodBigIntFormat = exports2.ZodBigInt = exports2.ZodBoolean = exports2.ZodNumberFormat = exports2.ZodNumber = exports2.ZodCustomStringFormat = exports2.ZodJWT = exports2.ZodE164 = exports2.ZodBase64URL = exports2.ZodBase64 = exports2.ZodCIDRv6 = exports2.ZodCIDRv4 = exports2.ZodIPv6 = exports2.ZodMAC = exports2.ZodIPv4 = exports2.ZodKSUID = exports2.ZodXID = exports2.ZodULID = exports2.ZodCUID2 = exports2.ZodCUID = exports2.ZodNanoID = exports2.ZodEmoji = exports2.ZodURL = exports2.ZodUUID = exports2.ZodGUID = exports2.ZodEmail = exports2.ZodStringFormat = exports2.ZodString = exports2._ZodString = exports2.ZodType = void 0;
    exports2.stringbool = exports2.meta = exports2.describe = exports2.ZodCustom = exports2.ZodFunction = exports2.ZodPromise = exports2.ZodLazy = exports2.ZodTemplateLiteral = exports2.ZodReadonly = exports2.ZodCodec = exports2.ZodPipe = exports2.ZodNaN = exports2.ZodCatch = exports2.ZodSuccess = exports2.ZodNonOptional = exports2.ZodPrefault = exports2.ZodDefault = exports2.ZodNullable = exports2.ZodExactOptional = exports2.ZodOptional = exports2.ZodTransform = exports2.ZodFile = void 0;
    exports2.string = string;
    exports2.email = email;
    exports2.guid = guid;
    exports2.uuid = uuid;
    exports2.uuidv4 = uuidv4;
    exports2.uuidv6 = uuidv6;
    exports2.uuidv7 = uuidv7;
    exports2.url = url;
    exports2.httpUrl = httpUrl;
    exports2.emoji = emoji;
    exports2.nanoid = nanoid;
    exports2.cuid = cuid;
    exports2.cuid2 = cuid2;
    exports2.ulid = ulid;
    exports2.xid = xid;
    exports2.ksuid = ksuid;
    exports2.ipv4 = ipv4;
    exports2.mac = mac;
    exports2.ipv6 = ipv6;
    exports2.cidrv4 = cidrv4;
    exports2.cidrv6 = cidrv6;
    exports2.base64 = base64;
    exports2.base64url = base64url;
    exports2.e164 = e164;
    exports2.jwt = jwt;
    exports2.stringFormat = stringFormat;
    exports2.hostname = hostname;
    exports2.hex = hex;
    exports2.hash = hash;
    exports2.number = number;
    exports2.int = int;
    exports2.float32 = float32;
    exports2.float64 = float64;
    exports2.int32 = int32;
    exports2.uint32 = uint32;
    exports2.boolean = boolean;
    exports2.bigint = bigint;
    exports2.int64 = int64;
    exports2.uint64 = uint64;
    exports2.symbol = symbol;
    exports2.undefined = _undefined;
    exports2.null = _null;
    exports2.any = any;
    exports2.unknown = unknown;
    exports2.never = never;
    exports2.void = _void;
    exports2.date = date;
    exports2.array = array;
    exports2.keyof = keyof;
    exports2.object = object;
    exports2.strictObject = strictObject;
    exports2.looseObject = looseObject;
    exports2.union = union;
    exports2.xor = xor;
    exports2.discriminatedUnion = discriminatedUnion;
    exports2.intersection = intersection;
    exports2.tuple = tuple;
    exports2.record = record;
    exports2.partialRecord = partialRecord;
    exports2.looseRecord = looseRecord;
    exports2.map = map;
    exports2.set = set;
    exports2.enum = _enum;
    exports2.nativeEnum = nativeEnum;
    exports2.literal = literal;
    exports2.file = file;
    exports2.transform = transform;
    exports2.optional = optional;
    exports2.exactOptional = exactOptional;
    exports2.nullable = nullable;
    exports2.nullish = nullish;
    exports2._default = _default;
    exports2.prefault = prefault;
    exports2.nonoptional = nonoptional;
    exports2.success = success;
    exports2.catch = _catch;
    exports2.nan = nan;
    exports2.pipe = pipe;
    exports2.codec = codec;
    exports2.readonly = readonly;
    exports2.templateLiteral = templateLiteral;
    exports2.lazy = lazy;
    exports2.promise = promise;
    exports2._function = _function;
    exports2.function = _function;
    exports2._function = _function;
    exports2.function = _function;
    exports2.check = check;
    exports2.custom = custom;
    exports2.refine = refine;
    exports2.superRefine = superRefine;
    exports2.instanceof = _instanceof;
    exports2.json = json;
    exports2.preprocess = preprocess;
    var core = __importStar(require_core2());
    var index_js_1 = require_core2();
    var processors = __importStar(require_json_schema_processors());
    var to_json_schema_js_1 = require_to_json_schema();
    var checks = __importStar(require_checks2());
    var iso = __importStar(require_iso());
    var parse = __importStar(require_parse2());
    exports2.ZodType = core.$constructor("ZodType", (inst, def) => {
      core.$ZodType.init(inst, def);
      Object.assign(inst["~standard"], {
        jsonSchema: {
          input: (0, to_json_schema_js_1.createStandardJSONSchemaMethod)(inst, "input"),
          output: (0, to_json_schema_js_1.createStandardJSONSchemaMethod)(inst, "output")
        }
      });
      inst.toJSONSchema = (0, to_json_schema_js_1.createToJSONSchemaMethod)(inst, {});
      inst.def = def;
      inst.type = def.type;
      Object.defineProperty(inst, "_def", { value: def });
      inst.check = (...checks2) => {
        return inst.clone(index_js_1.util.mergeDefs(def, {
          checks: [
            ...def.checks ?? [],
            ...checks2.map((ch) => typeof ch === "function" ? { _zod: { check: ch, def: { check: "custom" }, onattach: [] } } : ch)
          ]
        }), {
          parent: true
        });
      };
      inst.with = inst.check;
      inst.clone = (def2, params) => core.clone(inst, def2, params);
      inst.brand = () => inst;
      inst.register = ((reg, meta) => {
        reg.add(inst, meta);
        return inst;
      });
      inst.parse = (data, params) => parse.parse(inst, data, params, { callee: inst.parse });
      inst.safeParse = (data, params) => parse.safeParse(inst, data, params);
      inst.parseAsync = async (data, params) => parse.parseAsync(inst, data, params, { callee: inst.parseAsync });
      inst.safeParseAsync = async (data, params) => parse.safeParseAsync(inst, data, params);
      inst.spa = inst.safeParseAsync;
      inst.encode = (data, params) => parse.encode(inst, data, params);
      inst.decode = (data, params) => parse.decode(inst, data, params);
      inst.encodeAsync = async (data, params) => parse.encodeAsync(inst, data, params);
      inst.decodeAsync = async (data, params) => parse.decodeAsync(inst, data, params);
      inst.safeEncode = (data, params) => parse.safeEncode(inst, data, params);
      inst.safeDecode = (data, params) => parse.safeDecode(inst, data, params);
      inst.safeEncodeAsync = async (data, params) => parse.safeEncodeAsync(inst, data, params);
      inst.safeDecodeAsync = async (data, params) => parse.safeDecodeAsync(inst, data, params);
      inst.refine = (check2, params) => inst.check(refine(check2, params));
      inst.superRefine = (refinement) => inst.check(superRefine(refinement));
      inst.overwrite = (fn) => inst.check(checks.overwrite(fn));
      inst.optional = () => optional(inst);
      inst.exactOptional = () => exactOptional(inst);
      inst.nullable = () => nullable(inst);
      inst.nullish = () => optional(nullable(inst));
      inst.nonoptional = (params) => nonoptional(inst, params);
      inst.array = () => array(inst);
      inst.or = (arg) => union([inst, arg]);
      inst.and = (arg) => intersection(inst, arg);
      inst.transform = (tx) => pipe(inst, transform(tx));
      inst.default = (def2) => _default(inst, def2);
      inst.prefault = (def2) => prefault(inst, def2);
      inst.catch = (params) => _catch(inst, params);
      inst.pipe = (target) => pipe(inst, target);
      inst.readonly = () => readonly(inst);
      inst.describe = (description) => {
        const cl = inst.clone();
        core.globalRegistry.add(cl, { description });
        return cl;
      };
      Object.defineProperty(inst, "description", {
        get() {
          return core.globalRegistry.get(inst)?.description;
        },
        configurable: true
      });
      inst.meta = (...args) => {
        if (args.length === 0) {
          return core.globalRegistry.get(inst);
        }
        const cl = inst.clone();
        core.globalRegistry.add(cl, args[0]);
        return cl;
      };
      inst.isOptional = () => inst.safeParse(void 0).success;
      inst.isNullable = () => inst.safeParse(null).success;
      inst.apply = (fn) => fn(inst);
      return inst;
    });
    exports2._ZodString = core.$constructor("_ZodString", (inst, def) => {
      core.$ZodString.init(inst, def);
      exports2.ZodType.init(inst, def);
      inst._zod.processJSONSchema = (ctx, json2, params) => processors.stringProcessor(inst, ctx, json2, params);
      const bag = inst._zod.bag;
      inst.format = bag.format ?? null;
      inst.minLength = bag.minimum ?? null;
      inst.maxLength = bag.maximum ?? null;
      inst.regex = (...args) => inst.check(checks.regex(...args));
      inst.includes = (...args) => inst.check(checks.includes(...args));
      inst.startsWith = (...args) => inst.check(checks.startsWith(...args));
      inst.endsWith = (...args) => inst.check(checks.endsWith(...args));
      inst.min = (...args) => inst.check(checks.minLength(...args));
      inst.max = (...args) => inst.check(checks.maxLength(...args));
      inst.length = (...args) => inst.check(checks.length(...args));
      inst.nonempty = (...args) => inst.check(checks.minLength(1, ...args));
      inst.lowercase = (params) => inst.check(checks.lowercase(params));
      inst.uppercase = (params) => inst.check(checks.uppercase(params));
      inst.trim = () => inst.check(checks.trim());
      inst.normalize = (...args) => inst.check(checks.normalize(...args));
      inst.toLowerCase = () => inst.check(checks.toLowerCase());
      inst.toUpperCase = () => inst.check(checks.toUpperCase());
      inst.slugify = () => inst.check(checks.slugify());
    });
    exports2.ZodString = core.$constructor("ZodString", (inst, def) => {
      core.$ZodString.init(inst, def);
      exports2._ZodString.init(inst, def);
      inst.email = (params) => inst.check(core._email(exports2.ZodEmail, params));
      inst.url = (params) => inst.check(core._url(exports2.ZodURL, params));
      inst.jwt = (params) => inst.check(core._jwt(exports2.ZodJWT, params));
      inst.emoji = (params) => inst.check(core._emoji(exports2.ZodEmoji, params));
      inst.guid = (params) => inst.check(core._guid(exports2.ZodGUID, params));
      inst.uuid = (params) => inst.check(core._uuid(exports2.ZodUUID, params));
      inst.uuidv4 = (params) => inst.check(core._uuidv4(exports2.ZodUUID, params));
      inst.uuidv6 = (params) => inst.check(core._uuidv6(exports2.ZodUUID, params));
      inst.uuidv7 = (params) => inst.check(core._uuidv7(exports2.ZodUUID, params));
      inst.nanoid = (params) => inst.check(core._nanoid(exports2.ZodNanoID, params));
      inst.guid = (params) => inst.check(core._guid(exports2.ZodGUID, params));
      inst.cuid = (params) => inst.check(core._cuid(exports2.ZodCUID, params));
      inst.cuid2 = (params) => inst.check(core._cuid2(exports2.ZodCUID2, params));
      inst.ulid = (params) => inst.check(core._ulid(exports2.ZodULID, params));
      inst.base64 = (params) => inst.check(core._base64(exports2.ZodBase64, params));
      inst.base64url = (params) => inst.check(core._base64url(exports2.ZodBase64URL, params));
      inst.xid = (params) => inst.check(core._xid(exports2.ZodXID, params));
      inst.ksuid = (params) => inst.check(core._ksuid(exports2.ZodKSUID, params));
      inst.ipv4 = (params) => inst.check(core._ipv4(exports2.ZodIPv4, params));
      inst.ipv6 = (params) => inst.check(core._ipv6(exports2.ZodIPv6, params));
      inst.cidrv4 = (params) => inst.check(core._cidrv4(exports2.ZodCIDRv4, params));
      inst.cidrv6 = (params) => inst.check(core._cidrv6(exports2.ZodCIDRv6, params));
      inst.e164 = (params) => inst.check(core._e164(exports2.ZodE164, params));
      inst.datetime = (params) => inst.check(iso.datetime(params));
      inst.date = (params) => inst.check(iso.date(params));
      inst.time = (params) => inst.check(iso.time(params));
      inst.duration = (params) => inst.check(iso.duration(params));
    });
    function string(params) {
      return core._string(exports2.ZodString, params);
    }
    __name(string, "string");
    exports2.ZodStringFormat = core.$constructor("ZodStringFormat", (inst, def) => {
      core.$ZodStringFormat.init(inst, def);
      exports2._ZodString.init(inst, def);
    });
    exports2.ZodEmail = core.$constructor("ZodEmail", (inst, def) => {
      core.$ZodEmail.init(inst, def);
      exports2.ZodStringFormat.init(inst, def);
    });
    function email(params) {
      return core._email(exports2.ZodEmail, params);
    }
    __name(email, "email");
    exports2.ZodGUID = core.$constructor("ZodGUID", (inst, def) => {
      core.$ZodGUID.init(inst, def);
      exports2.ZodStringFormat.init(inst, def);
    });
    function guid(params) {
      return core._guid(exports2.ZodGUID, params);
    }
    __name(guid, "guid");
    exports2.ZodUUID = core.$constructor("ZodUUID", (inst, def) => {
      core.$ZodUUID.init(inst, def);
      exports2.ZodStringFormat.init(inst, def);
    });
    function uuid(params) {
      return core._uuid(exports2.ZodUUID, params);
    }
    __name(uuid, "uuid");
    function uuidv4(params) {
      return core._uuidv4(exports2.ZodUUID, params);
    }
    __name(uuidv4, "uuidv4");
    function uuidv6(params) {
      return core._uuidv6(exports2.ZodUUID, params);
    }
    __name(uuidv6, "uuidv6");
    function uuidv7(params) {
      return core._uuidv7(exports2.ZodUUID, params);
    }
    __name(uuidv7, "uuidv7");
    exports2.ZodURL = core.$constructor("ZodURL", (inst, def) => {
      core.$ZodURL.init(inst, def);
      exports2.ZodStringFormat.init(inst, def);
    });
    function url(params) {
      return core._url(exports2.ZodURL, params);
    }
    __name(url, "url");
    function httpUrl(params) {
      return core._url(exports2.ZodURL, {
        protocol: /^https?$/,
        hostname: core.regexes.domain,
        ...index_js_1.util.normalizeParams(params)
      });
    }
    __name(httpUrl, "httpUrl");
    exports2.ZodEmoji = core.$constructor("ZodEmoji", (inst, def) => {
      core.$ZodEmoji.init(inst, def);
      exports2.ZodStringFormat.init(inst, def);
    });
    function emoji(params) {
      return core._emoji(exports2.ZodEmoji, params);
    }
    __name(emoji, "emoji");
    exports2.ZodNanoID = core.$constructor("ZodNanoID", (inst, def) => {
      core.$ZodNanoID.init(inst, def);
      exports2.ZodStringFormat.init(inst, def);
    });
    function nanoid(params) {
      return core._nanoid(exports2.ZodNanoID, params);
    }
    __name(nanoid, "nanoid");
    exports2.ZodCUID = core.$constructor("ZodCUID", (inst, def) => {
      core.$ZodCUID.init(inst, def);
      exports2.ZodStringFormat.init(inst, def);
    });
    function cuid(params) {
      return core._cuid(exports2.ZodCUID, params);
    }
    __name(cuid, "cuid");
    exports2.ZodCUID2 = core.$constructor("ZodCUID2", (inst, def) => {
      core.$ZodCUID2.init(inst, def);
      exports2.ZodStringFormat.init(inst, def);
    });
    function cuid2(params) {
      return core._cuid2(exports2.ZodCUID2, params);
    }
    __name(cuid2, "cuid2");
    exports2.ZodULID = core.$constructor("ZodULID", (inst, def) => {
      core.$ZodULID.init(inst, def);
      exports2.ZodStringFormat.init(inst, def);
    });
    function ulid(params) {
      return core._ulid(exports2.ZodULID, params);
    }
    __name(ulid, "ulid");
    exports2.ZodXID = core.$constructor("ZodXID", (inst, def) => {
      core.$ZodXID.init(inst, def);
      exports2.ZodStringFormat.init(inst, def);
    });
    function xid(params) {
      return core._xid(exports2.ZodXID, params);
    }
    __name(xid, "xid");
    exports2.ZodKSUID = core.$constructor("ZodKSUID", (inst, def) => {
      core.$ZodKSUID.init(inst, def);
      exports2.ZodStringFormat.init(inst, def);
    });
    function ksuid(params) {
      return core._ksuid(exports2.ZodKSUID, params);
    }
    __name(ksuid, "ksuid");
    exports2.ZodIPv4 = core.$constructor("ZodIPv4", (inst, def) => {
      core.$ZodIPv4.init(inst, def);
      exports2.ZodStringFormat.init(inst, def);
    });
    function ipv4(params) {
      return core._ipv4(exports2.ZodIPv4, params);
    }
    __name(ipv4, "ipv4");
    exports2.ZodMAC = core.$constructor("ZodMAC", (inst, def) => {
      core.$ZodMAC.init(inst, def);
      exports2.ZodStringFormat.init(inst, def);
    });
    function mac(params) {
      return core._mac(exports2.ZodMAC, params);
    }
    __name(mac, "mac");
    exports2.ZodIPv6 = core.$constructor("ZodIPv6", (inst, def) => {
      core.$ZodIPv6.init(inst, def);
      exports2.ZodStringFormat.init(inst, def);
    });
    function ipv6(params) {
      return core._ipv6(exports2.ZodIPv6, params);
    }
    __name(ipv6, "ipv6");
    exports2.ZodCIDRv4 = core.$constructor("ZodCIDRv4", (inst, def) => {
      core.$ZodCIDRv4.init(inst, def);
      exports2.ZodStringFormat.init(inst, def);
    });
    function cidrv4(params) {
      return core._cidrv4(exports2.ZodCIDRv4, params);
    }
    __name(cidrv4, "cidrv4");
    exports2.ZodCIDRv6 = core.$constructor("ZodCIDRv6", (inst, def) => {
      core.$ZodCIDRv6.init(inst, def);
      exports2.ZodStringFormat.init(inst, def);
    });
    function cidrv6(params) {
      return core._cidrv6(exports2.ZodCIDRv6, params);
    }
    __name(cidrv6, "cidrv6");
    exports2.ZodBase64 = core.$constructor("ZodBase64", (inst, def) => {
      core.$ZodBase64.init(inst, def);
      exports2.ZodStringFormat.init(inst, def);
    });
    function base64(params) {
      return core._base64(exports2.ZodBase64, params);
    }
    __name(base64, "base64");
    exports2.ZodBase64URL = core.$constructor("ZodBase64URL", (inst, def) => {
      core.$ZodBase64URL.init(inst, def);
      exports2.ZodStringFormat.init(inst, def);
    });
    function base64url(params) {
      return core._base64url(exports2.ZodBase64URL, params);
    }
    __name(base64url, "base64url");
    exports2.ZodE164 = core.$constructor("ZodE164", (inst, def) => {
      core.$ZodE164.init(inst, def);
      exports2.ZodStringFormat.init(inst, def);
    });
    function e164(params) {
      return core._e164(exports2.ZodE164, params);
    }
    __name(e164, "e164");
    exports2.ZodJWT = core.$constructor("ZodJWT", (inst, def) => {
      core.$ZodJWT.init(inst, def);
      exports2.ZodStringFormat.init(inst, def);
    });
    function jwt(params) {
      return core._jwt(exports2.ZodJWT, params);
    }
    __name(jwt, "jwt");
    exports2.ZodCustomStringFormat = core.$constructor("ZodCustomStringFormat", (inst, def) => {
      core.$ZodCustomStringFormat.init(inst, def);
      exports2.ZodStringFormat.init(inst, def);
    });
    function stringFormat(format, fnOrRegex, _params = {}) {
      return core._stringFormat(exports2.ZodCustomStringFormat, format, fnOrRegex, _params);
    }
    __name(stringFormat, "stringFormat");
    function hostname(_params) {
      return core._stringFormat(exports2.ZodCustomStringFormat, "hostname", core.regexes.hostname, _params);
    }
    __name(hostname, "hostname");
    function hex(_params) {
      return core._stringFormat(exports2.ZodCustomStringFormat, "hex", core.regexes.hex, _params);
    }
    __name(hex, "hex");
    function hash(alg, params) {
      const enc = params?.enc ?? "hex";
      const format = `${alg}_${enc}`;
      const regex = core.regexes[format];
      if (!regex)
        throw new Error(`Unrecognized hash format: ${format}`);
      return core._stringFormat(exports2.ZodCustomStringFormat, format, regex, params);
    }
    __name(hash, "hash");
    exports2.ZodNumber = core.$constructor("ZodNumber", (inst, def) => {
      core.$ZodNumber.init(inst, def);
      exports2.ZodType.init(inst, def);
      inst._zod.processJSONSchema = (ctx, json2, params) => processors.numberProcessor(inst, ctx, json2, params);
      inst.gt = (value, params) => inst.check(checks.gt(value, params));
      inst.gte = (value, params) => inst.check(checks.gte(value, params));
      inst.min = (value, params) => inst.check(checks.gte(value, params));
      inst.lt = (value, params) => inst.check(checks.lt(value, params));
      inst.lte = (value, params) => inst.check(checks.lte(value, params));
      inst.max = (value, params) => inst.check(checks.lte(value, params));
      inst.int = (params) => inst.check(int(params));
      inst.safe = (params) => inst.check(int(params));
      inst.positive = (params) => inst.check(checks.gt(0, params));
      inst.nonnegative = (params) => inst.check(checks.gte(0, params));
      inst.negative = (params) => inst.check(checks.lt(0, params));
      inst.nonpositive = (params) => inst.check(checks.lte(0, params));
      inst.multipleOf = (value, params) => inst.check(checks.multipleOf(value, params));
      inst.step = (value, params) => inst.check(checks.multipleOf(value, params));
      inst.finite = () => inst;
      const bag = inst._zod.bag;
      inst.minValue = Math.max(bag.minimum ?? Number.NEGATIVE_INFINITY, bag.exclusiveMinimum ?? Number.NEGATIVE_INFINITY) ?? null;
      inst.maxValue = Math.min(bag.maximum ?? Number.POSITIVE_INFINITY, bag.exclusiveMaximum ?? Number.POSITIVE_INFINITY) ?? null;
      inst.isInt = (bag.format ?? "").includes("int") || Number.isSafeInteger(bag.multipleOf ?? 0.5);
      inst.isFinite = true;
      inst.format = bag.format ?? null;
    });
    function number(params) {
      return core._number(exports2.ZodNumber, params);
    }
    __name(number, "number");
    exports2.ZodNumberFormat = core.$constructor("ZodNumberFormat", (inst, def) => {
      core.$ZodNumberFormat.init(inst, def);
      exports2.ZodNumber.init(inst, def);
    });
    function int(params) {
      return core._int(exports2.ZodNumberFormat, params);
    }
    __name(int, "int");
    function float32(params) {
      return core._float32(exports2.ZodNumberFormat, params);
    }
    __name(float32, "float32");
    function float64(params) {
      return core._float64(exports2.ZodNumberFormat, params);
    }
    __name(float64, "float64");
    function int32(params) {
      return core._int32(exports2.ZodNumberFormat, params);
    }
    __name(int32, "int32");
    function uint32(params) {
      return core._uint32(exports2.ZodNumberFormat, params);
    }
    __name(uint32, "uint32");
    exports2.ZodBoolean = core.$constructor("ZodBoolean", (inst, def) => {
      core.$ZodBoolean.init(inst, def);
      exports2.ZodType.init(inst, def);
      inst._zod.processJSONSchema = (ctx, json2, params) => processors.booleanProcessor(inst, ctx, json2, params);
    });
    function boolean(params) {
      return core._boolean(exports2.ZodBoolean, params);
    }
    __name(boolean, "boolean");
    exports2.ZodBigInt = core.$constructor("ZodBigInt", (inst, def) => {
      core.$ZodBigInt.init(inst, def);
      exports2.ZodType.init(inst, def);
      inst._zod.processJSONSchema = (ctx, json2, params) => processors.bigintProcessor(inst, ctx, json2, params);
      inst.gte = (value, params) => inst.check(checks.gte(value, params));
      inst.min = (value, params) => inst.check(checks.gte(value, params));
      inst.gt = (value, params) => inst.check(checks.gt(value, params));
      inst.gte = (value, params) => inst.check(checks.gte(value, params));
      inst.min = (value, params) => inst.check(checks.gte(value, params));
      inst.lt = (value, params) => inst.check(checks.lt(value, params));
      inst.lte = (value, params) => inst.check(checks.lte(value, params));
      inst.max = (value, params) => inst.check(checks.lte(value, params));
      inst.positive = (params) => inst.check(checks.gt(BigInt(0), params));
      inst.negative = (params) => inst.check(checks.lt(BigInt(0), params));
      inst.nonpositive = (params) => inst.check(checks.lte(BigInt(0), params));
      inst.nonnegative = (params) => inst.check(checks.gte(BigInt(0), params));
      inst.multipleOf = (value, params) => inst.check(checks.multipleOf(value, params));
      const bag = inst._zod.bag;
      inst.minValue = bag.minimum ?? null;
      inst.maxValue = bag.maximum ?? null;
      inst.format = bag.format ?? null;
    });
    function bigint(params) {
      return core._bigint(exports2.ZodBigInt, params);
    }
    __name(bigint, "bigint");
    exports2.ZodBigIntFormat = core.$constructor("ZodBigIntFormat", (inst, def) => {
      core.$ZodBigIntFormat.init(inst, def);
      exports2.ZodBigInt.init(inst, def);
    });
    function int64(params) {
      return core._int64(exports2.ZodBigIntFormat, params);
    }
    __name(int64, "int64");
    function uint64(params) {
      return core._uint64(exports2.ZodBigIntFormat, params);
    }
    __name(uint64, "uint64");
    exports2.ZodSymbol = core.$constructor("ZodSymbol", (inst, def) => {
      core.$ZodSymbol.init(inst, def);
      exports2.ZodType.init(inst, def);
      inst._zod.processJSONSchema = (ctx, json2, params) => processors.symbolProcessor(inst, ctx, json2, params);
    });
    function symbol(params) {
      return core._symbol(exports2.ZodSymbol, params);
    }
    __name(symbol, "symbol");
    exports2.ZodUndefined = core.$constructor("ZodUndefined", (inst, def) => {
      core.$ZodUndefined.init(inst, def);
      exports2.ZodType.init(inst, def);
      inst._zod.processJSONSchema = (ctx, json2, params) => processors.undefinedProcessor(inst, ctx, json2, params);
    });
    function _undefined(params) {
      return core._undefined(exports2.ZodUndefined, params);
    }
    __name(_undefined, "_undefined");
    exports2.ZodNull = core.$constructor("ZodNull", (inst, def) => {
      core.$ZodNull.init(inst, def);
      exports2.ZodType.init(inst, def);
      inst._zod.processJSONSchema = (ctx, json2, params) => processors.nullProcessor(inst, ctx, json2, params);
    });
    function _null(params) {
      return core._null(exports2.ZodNull, params);
    }
    __name(_null, "_null");
    exports2.ZodAny = core.$constructor("ZodAny", (inst, def) => {
      core.$ZodAny.init(inst, def);
      exports2.ZodType.init(inst, def);
      inst._zod.processJSONSchema = (ctx, json2, params) => processors.anyProcessor(inst, ctx, json2, params);
    });
    function any() {
      return core._any(exports2.ZodAny);
    }
    __name(any, "any");
    exports2.ZodUnknown = core.$constructor("ZodUnknown", (inst, def) => {
      core.$ZodUnknown.init(inst, def);
      exports2.ZodType.init(inst, def);
      inst._zod.processJSONSchema = (ctx, json2, params) => processors.unknownProcessor(inst, ctx, json2, params);
    });
    function unknown() {
      return core._unknown(exports2.ZodUnknown);
    }
    __name(unknown, "unknown");
    exports2.ZodNever = core.$constructor("ZodNever", (inst, def) => {
      core.$ZodNever.init(inst, def);
      exports2.ZodType.init(inst, def);
      inst._zod.processJSONSchema = (ctx, json2, params) => processors.neverProcessor(inst, ctx, json2, params);
    });
    function never(params) {
      return core._never(exports2.ZodNever, params);
    }
    __name(never, "never");
    exports2.ZodVoid = core.$constructor("ZodVoid", (inst, def) => {
      core.$ZodVoid.init(inst, def);
      exports2.ZodType.init(inst, def);
      inst._zod.processJSONSchema = (ctx, json2, params) => processors.voidProcessor(inst, ctx, json2, params);
    });
    function _void(params) {
      return core._void(exports2.ZodVoid, params);
    }
    __name(_void, "_void");
    exports2.ZodDate = core.$constructor("ZodDate", (inst, def) => {
      core.$ZodDate.init(inst, def);
      exports2.ZodType.init(inst, def);
      inst._zod.processJSONSchema = (ctx, json2, params) => processors.dateProcessor(inst, ctx, json2, params);
      inst.min = (value, params) => inst.check(checks.gte(value, params));
      inst.max = (value, params) => inst.check(checks.lte(value, params));
      const c = inst._zod.bag;
      inst.minDate = c.minimum ? new Date(c.minimum) : null;
      inst.maxDate = c.maximum ? new Date(c.maximum) : null;
    });
    function date(params) {
      return core._date(exports2.ZodDate, params);
    }
    __name(date, "date");
    exports2.ZodArray = core.$constructor("ZodArray", (inst, def) => {
      core.$ZodArray.init(inst, def);
      exports2.ZodType.init(inst, def);
      inst._zod.processJSONSchema = (ctx, json2, params) => processors.arrayProcessor(inst, ctx, json2, params);
      inst.element = def.element;
      inst.min = (minLength, params) => inst.check(checks.minLength(minLength, params));
      inst.nonempty = (params) => inst.check(checks.minLength(1, params));
      inst.max = (maxLength, params) => inst.check(checks.maxLength(maxLength, params));
      inst.length = (len, params) => inst.check(checks.length(len, params));
      inst.unwrap = () => inst.element;
    });
    function array(element, params) {
      return core._array(exports2.ZodArray, element, params);
    }
    __name(array, "array");
    function keyof(schema) {
      const shape = schema._zod.def.shape;
      return _enum(Object.keys(shape));
    }
    __name(keyof, "keyof");
    exports2.ZodObject = core.$constructor("ZodObject", (inst, def) => {
      core.$ZodObjectJIT.init(inst, def);
      exports2.ZodType.init(inst, def);
      inst._zod.processJSONSchema = (ctx, json2, params) => processors.objectProcessor(inst, ctx, json2, params);
      index_js_1.util.defineLazy(inst, "shape", () => {
        return def.shape;
      });
      inst.keyof = () => _enum(Object.keys(inst._zod.def.shape));
      inst.catchall = (catchall) => inst.clone({ ...inst._zod.def, catchall });
      inst.passthrough = () => inst.clone({ ...inst._zod.def, catchall: unknown() });
      inst.loose = () => inst.clone({ ...inst._zod.def, catchall: unknown() });
      inst.strict = () => inst.clone({ ...inst._zod.def, catchall: never() });
      inst.strip = () => inst.clone({ ...inst._zod.def, catchall: void 0 });
      inst.extend = (incoming) => {
        return index_js_1.util.extend(inst, incoming);
      };
      inst.safeExtend = (incoming) => {
        return index_js_1.util.safeExtend(inst, incoming);
      };
      inst.merge = (other) => index_js_1.util.merge(inst, other);
      inst.pick = (mask) => index_js_1.util.pick(inst, mask);
      inst.omit = (mask) => index_js_1.util.omit(inst, mask);
      inst.partial = (...args) => index_js_1.util.partial(exports2.ZodOptional, inst, args[0]);
      inst.required = (...args) => index_js_1.util.required(exports2.ZodNonOptional, inst, args[0]);
    });
    function object(shape, params) {
      const def = {
        type: "object",
        shape: shape ?? {},
        ...index_js_1.util.normalizeParams(params)
      };
      return new exports2.ZodObject(def);
    }
    __name(object, "object");
    function strictObject(shape, params) {
      return new exports2.ZodObject({
        type: "object",
        shape,
        catchall: never(),
        ...index_js_1.util.normalizeParams(params)
      });
    }
    __name(strictObject, "strictObject");
    function looseObject(shape, params) {
      return new exports2.ZodObject({
        type: "object",
        shape,
        catchall: unknown(),
        ...index_js_1.util.normalizeParams(params)
      });
    }
    __name(looseObject, "looseObject");
    exports2.ZodUnion = core.$constructor("ZodUnion", (inst, def) => {
      core.$ZodUnion.init(inst, def);
      exports2.ZodType.init(inst, def);
      inst._zod.processJSONSchema = (ctx, json2, params) => processors.unionProcessor(inst, ctx, json2, params);
      inst.options = def.options;
    });
    function union(options, params) {
      return new exports2.ZodUnion({
        type: "union",
        options,
        ...index_js_1.util.normalizeParams(params)
      });
    }
    __name(union, "union");
    exports2.ZodXor = core.$constructor("ZodXor", (inst, def) => {
      exports2.ZodUnion.init(inst, def);
      core.$ZodXor.init(inst, def);
      inst._zod.processJSONSchema = (ctx, json2, params) => processors.unionProcessor(inst, ctx, json2, params);
      inst.options = def.options;
    });
    function xor(options, params) {
      return new exports2.ZodXor({
        type: "union",
        options,
        inclusive: false,
        ...index_js_1.util.normalizeParams(params)
      });
    }
    __name(xor, "xor");
    exports2.ZodDiscriminatedUnion = core.$constructor("ZodDiscriminatedUnion", (inst, def) => {
      exports2.ZodUnion.init(inst, def);
      core.$ZodDiscriminatedUnion.init(inst, def);
    });
    function discriminatedUnion(discriminator, options, params) {
      return new exports2.ZodDiscriminatedUnion({
        type: "union",
        options,
        discriminator,
        ...index_js_1.util.normalizeParams(params)
      });
    }
    __name(discriminatedUnion, "discriminatedUnion");
    exports2.ZodIntersection = core.$constructor("ZodIntersection", (inst, def) => {
      core.$ZodIntersection.init(inst, def);
      exports2.ZodType.init(inst, def);
      inst._zod.processJSONSchema = (ctx, json2, params) => processors.intersectionProcessor(inst, ctx, json2, params);
    });
    function intersection(left, right) {
      return new exports2.ZodIntersection({
        type: "intersection",
        left,
        right
      });
    }
    __name(intersection, "intersection");
    exports2.ZodTuple = core.$constructor("ZodTuple", (inst, def) => {
      core.$ZodTuple.init(inst, def);
      exports2.ZodType.init(inst, def);
      inst._zod.processJSONSchema = (ctx, json2, params) => processors.tupleProcessor(inst, ctx, json2, params);
      inst.rest = (rest) => inst.clone({
        ...inst._zod.def,
        rest
      });
    });
    function tuple(items, _paramsOrRest, _params) {
      const hasRest = _paramsOrRest instanceof core.$ZodType;
      const params = hasRest ? _params : _paramsOrRest;
      const rest = hasRest ? _paramsOrRest : null;
      return new exports2.ZodTuple({
        type: "tuple",
        items,
        rest,
        ...index_js_1.util.normalizeParams(params)
      });
    }
    __name(tuple, "tuple");
    exports2.ZodRecord = core.$constructor("ZodRecord", (inst, def) => {
      core.$ZodRecord.init(inst, def);
      exports2.ZodType.init(inst, def);
      inst._zod.processJSONSchema = (ctx, json2, params) => processors.recordProcessor(inst, ctx, json2, params);
      inst.keyType = def.keyType;
      inst.valueType = def.valueType;
    });
    function record(keyType, valueType, params) {
      return new exports2.ZodRecord({
        type: "record",
        keyType,
        valueType,
        ...index_js_1.util.normalizeParams(params)
      });
    }
    __name(record, "record");
    function partialRecord(keyType, valueType, params) {
      const k = core.clone(keyType);
      k._zod.values = void 0;
      return new exports2.ZodRecord({
        type: "record",
        keyType: k,
        valueType,
        ...index_js_1.util.normalizeParams(params)
      });
    }
    __name(partialRecord, "partialRecord");
    function looseRecord(keyType, valueType, params) {
      return new exports2.ZodRecord({
        type: "record",
        keyType,
        valueType,
        mode: "loose",
        ...index_js_1.util.normalizeParams(params)
      });
    }
    __name(looseRecord, "looseRecord");
    exports2.ZodMap = core.$constructor("ZodMap", (inst, def) => {
      core.$ZodMap.init(inst, def);
      exports2.ZodType.init(inst, def);
      inst._zod.processJSONSchema = (ctx, json2, params) => processors.mapProcessor(inst, ctx, json2, params);
      inst.keyType = def.keyType;
      inst.valueType = def.valueType;
      inst.min = (...args) => inst.check(core._minSize(...args));
      inst.nonempty = (params) => inst.check(core._minSize(1, params));
      inst.max = (...args) => inst.check(core._maxSize(...args));
      inst.size = (...args) => inst.check(core._size(...args));
    });
    function map(keyType, valueType, params) {
      return new exports2.ZodMap({
        type: "map",
        keyType,
        valueType,
        ...index_js_1.util.normalizeParams(params)
      });
    }
    __name(map, "map");
    exports2.ZodSet = core.$constructor("ZodSet", (inst, def) => {
      core.$ZodSet.init(inst, def);
      exports2.ZodType.init(inst, def);
      inst._zod.processJSONSchema = (ctx, json2, params) => processors.setProcessor(inst, ctx, json2, params);
      inst.min = (...args) => inst.check(core._minSize(...args));
      inst.nonempty = (params) => inst.check(core._minSize(1, params));
      inst.max = (...args) => inst.check(core._maxSize(...args));
      inst.size = (...args) => inst.check(core._size(...args));
    });
    function set(valueType, params) {
      return new exports2.ZodSet({
        type: "set",
        valueType,
        ...index_js_1.util.normalizeParams(params)
      });
    }
    __name(set, "set");
    exports2.ZodEnum = core.$constructor("ZodEnum", (inst, def) => {
      core.$ZodEnum.init(inst, def);
      exports2.ZodType.init(inst, def);
      inst._zod.processJSONSchema = (ctx, json2, params) => processors.enumProcessor(inst, ctx, json2, params);
      inst.enum = def.entries;
      inst.options = Object.values(def.entries);
      const keys = new Set(Object.keys(def.entries));
      inst.extract = (values, params) => {
        const newEntries = {};
        for (const value of values) {
          if (keys.has(value)) {
            newEntries[value] = def.entries[value];
          } else
            throw new Error(`Key ${value} not found in enum`);
        }
        return new exports2.ZodEnum({
          ...def,
          checks: [],
          ...index_js_1.util.normalizeParams(params),
          entries: newEntries
        });
      };
      inst.exclude = (values, params) => {
        const newEntries = { ...def.entries };
        for (const value of values) {
          if (keys.has(value)) {
            delete newEntries[value];
          } else
            throw new Error(`Key ${value} not found in enum`);
        }
        return new exports2.ZodEnum({
          ...def,
          checks: [],
          ...index_js_1.util.normalizeParams(params),
          entries: newEntries
        });
      };
    });
    function _enum(values, params) {
      const entries = Array.isArray(values) ? Object.fromEntries(values.map((v) => [v, v])) : values;
      return new exports2.ZodEnum({
        type: "enum",
        entries,
        ...index_js_1.util.normalizeParams(params)
      });
    }
    __name(_enum, "_enum");
    function nativeEnum(entries, params) {
      return new exports2.ZodEnum({
        type: "enum",
        entries,
        ...index_js_1.util.normalizeParams(params)
      });
    }
    __name(nativeEnum, "nativeEnum");
    exports2.ZodLiteral = core.$constructor("ZodLiteral", (inst, def) => {
      core.$ZodLiteral.init(inst, def);
      exports2.ZodType.init(inst, def);
      inst._zod.processJSONSchema = (ctx, json2, params) => processors.literalProcessor(inst, ctx, json2, params);
      inst.values = new Set(def.values);
      Object.defineProperty(inst, "value", {
        get() {
          if (def.values.length > 1) {
            throw new Error("This schema contains multiple valid literal values. Use `.values` instead.");
          }
          return def.values[0];
        }
      });
    });
    function literal(value, params) {
      return new exports2.ZodLiteral({
        type: "literal",
        values: Array.isArray(value) ? value : [value],
        ...index_js_1.util.normalizeParams(params)
      });
    }
    __name(literal, "literal");
    exports2.ZodFile = core.$constructor("ZodFile", (inst, def) => {
      core.$ZodFile.init(inst, def);
      exports2.ZodType.init(inst, def);
      inst._zod.processJSONSchema = (ctx, json2, params) => processors.fileProcessor(inst, ctx, json2, params);
      inst.min = (size, params) => inst.check(core._minSize(size, params));
      inst.max = (size, params) => inst.check(core._maxSize(size, params));
      inst.mime = (types, params) => inst.check(core._mime(Array.isArray(types) ? types : [types], params));
    });
    function file(params) {
      return core._file(exports2.ZodFile, params);
    }
    __name(file, "file");
    exports2.ZodTransform = core.$constructor("ZodTransform", (inst, def) => {
      core.$ZodTransform.init(inst, def);
      exports2.ZodType.init(inst, def);
      inst._zod.processJSONSchema = (ctx, json2, params) => processors.transformProcessor(inst, ctx, json2, params);
      inst._zod.parse = (payload, _ctx) => {
        if (_ctx.direction === "backward") {
          throw new core.$ZodEncodeError(inst.constructor.name);
        }
        payload.addIssue = (issue) => {
          if (typeof issue === "string") {
            payload.issues.push(index_js_1.util.issue(issue, payload.value, def));
          } else {
            const _issue = issue;
            if (_issue.fatal)
              _issue.continue = false;
            _issue.code ?? (_issue.code = "custom");
            _issue.input ?? (_issue.input = payload.value);
            _issue.inst ?? (_issue.inst = inst);
            payload.issues.push(index_js_1.util.issue(_issue));
          }
        };
        const output = def.transform(payload.value, payload);
        if (output instanceof Promise) {
          return output.then((output2) => {
            payload.value = output2;
            return payload;
          });
        }
        payload.value = output;
        return payload;
      };
    });
    function transform(fn) {
      return new exports2.ZodTransform({
        type: "transform",
        transform: fn
      });
    }
    __name(transform, "transform");
    exports2.ZodOptional = core.$constructor("ZodOptional", (inst, def) => {
      core.$ZodOptional.init(inst, def);
      exports2.ZodType.init(inst, def);
      inst._zod.processJSONSchema = (ctx, json2, params) => processors.optionalProcessor(inst, ctx, json2, params);
      inst.unwrap = () => inst._zod.def.innerType;
    });
    function optional(innerType) {
      return new exports2.ZodOptional({
        type: "optional",
        innerType
      });
    }
    __name(optional, "optional");
    exports2.ZodExactOptional = core.$constructor("ZodExactOptional", (inst, def) => {
      core.$ZodExactOptional.init(inst, def);
      exports2.ZodType.init(inst, def);
      inst._zod.processJSONSchema = (ctx, json2, params) => processors.optionalProcessor(inst, ctx, json2, params);
      inst.unwrap = () => inst._zod.def.innerType;
    });
    function exactOptional(innerType) {
      return new exports2.ZodExactOptional({
        type: "optional",
        innerType
      });
    }
    __name(exactOptional, "exactOptional");
    exports2.ZodNullable = core.$constructor("ZodNullable", (inst, def) => {
      core.$ZodNullable.init(inst, def);
      exports2.ZodType.init(inst, def);
      inst._zod.processJSONSchema = (ctx, json2, params) => processors.nullableProcessor(inst, ctx, json2, params);
      inst.unwrap = () => inst._zod.def.innerType;
    });
    function nullable(innerType) {
      return new exports2.ZodNullable({
        type: "nullable",
        innerType
      });
    }
    __name(nullable, "nullable");
    function nullish(innerType) {
      return optional(nullable(innerType));
    }
    __name(nullish, "nullish");
    exports2.ZodDefault = core.$constructor("ZodDefault", (inst, def) => {
      core.$ZodDefault.init(inst, def);
      exports2.ZodType.init(inst, def);
      inst._zod.processJSONSchema = (ctx, json2, params) => processors.defaultProcessor(inst, ctx, json2, params);
      inst.unwrap = () => inst._zod.def.innerType;
      inst.removeDefault = inst.unwrap;
    });
    function _default(innerType, defaultValue) {
      return new exports2.ZodDefault({
        type: "default",
        innerType,
        get defaultValue() {
          return typeof defaultValue === "function" ? defaultValue() : index_js_1.util.shallowClone(defaultValue);
        }
      });
    }
    __name(_default, "_default");
    exports2.ZodPrefault = core.$constructor("ZodPrefault", (inst, def) => {
      core.$ZodPrefault.init(inst, def);
      exports2.ZodType.init(inst, def);
      inst._zod.processJSONSchema = (ctx, json2, params) => processors.prefaultProcessor(inst, ctx, json2, params);
      inst.unwrap = () => inst._zod.def.innerType;
    });
    function prefault(innerType, defaultValue) {
      return new exports2.ZodPrefault({
        type: "prefault",
        innerType,
        get defaultValue() {
          return typeof defaultValue === "function" ? defaultValue() : index_js_1.util.shallowClone(defaultValue);
        }
      });
    }
    __name(prefault, "prefault");
    exports2.ZodNonOptional = core.$constructor("ZodNonOptional", (inst, def) => {
      core.$ZodNonOptional.init(inst, def);
      exports2.ZodType.init(inst, def);
      inst._zod.processJSONSchema = (ctx, json2, params) => processors.nonoptionalProcessor(inst, ctx, json2, params);
      inst.unwrap = () => inst._zod.def.innerType;
    });
    function nonoptional(innerType, params) {
      return new exports2.ZodNonOptional({
        type: "nonoptional",
        innerType,
        ...index_js_1.util.normalizeParams(params)
      });
    }
    __name(nonoptional, "nonoptional");
    exports2.ZodSuccess = core.$constructor("ZodSuccess", (inst, def) => {
      core.$ZodSuccess.init(inst, def);
      exports2.ZodType.init(inst, def);
      inst._zod.processJSONSchema = (ctx, json2, params) => processors.successProcessor(inst, ctx, json2, params);
      inst.unwrap = () => inst._zod.def.innerType;
    });
    function success(innerType) {
      return new exports2.ZodSuccess({
        type: "success",
        innerType
      });
    }
    __name(success, "success");
    exports2.ZodCatch = core.$constructor("ZodCatch", (inst, def) => {
      core.$ZodCatch.init(inst, def);
      exports2.ZodType.init(inst, def);
      inst._zod.processJSONSchema = (ctx, json2, params) => processors.catchProcessor(inst, ctx, json2, params);
      inst.unwrap = () => inst._zod.def.innerType;
      inst.removeCatch = inst.unwrap;
    });
    function _catch(innerType, catchValue) {
      return new exports2.ZodCatch({
        type: "catch",
        innerType,
        catchValue: typeof catchValue === "function" ? catchValue : () => catchValue
      });
    }
    __name(_catch, "_catch");
    exports2.ZodNaN = core.$constructor("ZodNaN", (inst, def) => {
      core.$ZodNaN.init(inst, def);
      exports2.ZodType.init(inst, def);
      inst._zod.processJSONSchema = (ctx, json2, params) => processors.nanProcessor(inst, ctx, json2, params);
    });
    function nan(params) {
      return core._nan(exports2.ZodNaN, params);
    }
    __name(nan, "nan");
    exports2.ZodPipe = core.$constructor("ZodPipe", (inst, def) => {
      core.$ZodPipe.init(inst, def);
      exports2.ZodType.init(inst, def);
      inst._zod.processJSONSchema = (ctx, json2, params) => processors.pipeProcessor(inst, ctx, json2, params);
      inst.in = def.in;
      inst.out = def.out;
    });
    function pipe(in_, out) {
      return new exports2.ZodPipe({
        type: "pipe",
        in: in_,
        out
        // ...util.normalizeParams(params),
      });
    }
    __name(pipe, "pipe");
    exports2.ZodCodec = core.$constructor("ZodCodec", (inst, def) => {
      exports2.ZodPipe.init(inst, def);
      core.$ZodCodec.init(inst, def);
    });
    function codec(in_, out, params) {
      return new exports2.ZodCodec({
        type: "pipe",
        in: in_,
        out,
        transform: params.decode,
        reverseTransform: params.encode
      });
    }
    __name(codec, "codec");
    exports2.ZodReadonly = core.$constructor("ZodReadonly", (inst, def) => {
      core.$ZodReadonly.init(inst, def);
      exports2.ZodType.init(inst, def);
      inst._zod.processJSONSchema = (ctx, json2, params) => processors.readonlyProcessor(inst, ctx, json2, params);
      inst.unwrap = () => inst._zod.def.innerType;
    });
    function readonly(innerType) {
      return new exports2.ZodReadonly({
        type: "readonly",
        innerType
      });
    }
    __name(readonly, "readonly");
    exports2.ZodTemplateLiteral = core.$constructor("ZodTemplateLiteral", (inst, def) => {
      core.$ZodTemplateLiteral.init(inst, def);
      exports2.ZodType.init(inst, def);
      inst._zod.processJSONSchema = (ctx, json2, params) => processors.templateLiteralProcessor(inst, ctx, json2, params);
    });
    function templateLiteral(parts, params) {
      return new exports2.ZodTemplateLiteral({
        type: "template_literal",
        parts,
        ...index_js_1.util.normalizeParams(params)
      });
    }
    __name(templateLiteral, "templateLiteral");
    exports2.ZodLazy = core.$constructor("ZodLazy", (inst, def) => {
      core.$ZodLazy.init(inst, def);
      exports2.ZodType.init(inst, def);
      inst._zod.processJSONSchema = (ctx, json2, params) => processors.lazyProcessor(inst, ctx, json2, params);
      inst.unwrap = () => inst._zod.def.getter();
    });
    function lazy(getter) {
      return new exports2.ZodLazy({
        type: "lazy",
        getter
      });
    }
    __name(lazy, "lazy");
    exports2.ZodPromise = core.$constructor("ZodPromise", (inst, def) => {
      core.$ZodPromise.init(inst, def);
      exports2.ZodType.init(inst, def);
      inst._zod.processJSONSchema = (ctx, json2, params) => processors.promiseProcessor(inst, ctx, json2, params);
      inst.unwrap = () => inst._zod.def.innerType;
    });
    function promise(innerType) {
      return new exports2.ZodPromise({
        type: "promise",
        innerType
      });
    }
    __name(promise, "promise");
    exports2.ZodFunction = core.$constructor("ZodFunction", (inst, def) => {
      core.$ZodFunction.init(inst, def);
      exports2.ZodType.init(inst, def);
      inst._zod.processJSONSchema = (ctx, json2, params) => processors.functionProcessor(inst, ctx, json2, params);
    });
    function _function(params) {
      return new exports2.ZodFunction({
        type: "function",
        input: Array.isArray(params?.input) ? tuple(params?.input) : params?.input ?? array(unknown()),
        output: params?.output ?? unknown()
      });
    }
    __name(_function, "_function");
    exports2.ZodCustom = core.$constructor("ZodCustom", (inst, def) => {
      core.$ZodCustom.init(inst, def);
      exports2.ZodType.init(inst, def);
      inst._zod.processJSONSchema = (ctx, json2, params) => processors.customProcessor(inst, ctx, json2, params);
    });
    function check(fn) {
      const ch = new core.$ZodCheck({
        check: "custom"
        // ...util.normalizeParams(params),
      });
      ch._zod.check = fn;
      return ch;
    }
    __name(check, "check");
    function custom(fn, _params) {
      return core._custom(exports2.ZodCustom, fn ?? (() => true), _params);
    }
    __name(custom, "custom");
    function refine(fn, _params = {}) {
      return core._refine(exports2.ZodCustom, fn, _params);
    }
    __name(refine, "refine");
    function superRefine(fn) {
      return core._superRefine(fn);
    }
    __name(superRefine, "superRefine");
    exports2.describe = core.describe;
    exports2.meta = core.meta;
    function _instanceof(cls, params = {}) {
      const inst = new exports2.ZodCustom({
        type: "custom",
        check: "custom",
        fn: /* @__PURE__ */ __name((data) => data instanceof cls, "fn"),
        abort: true,
        ...index_js_1.util.normalizeParams(params)
      });
      inst._zod.bag.Class = cls;
      inst._zod.check = (payload) => {
        if (!(payload.value instanceof cls)) {
          payload.issues.push({
            code: "invalid_type",
            expected: cls.name,
            input: payload.value,
            inst,
            path: [...inst._zod.def.path ?? []]
          });
        }
      };
      return inst;
    }
    __name(_instanceof, "_instanceof");
    var stringbool = /* @__PURE__ */ __name((...args) => core._stringbool({
      Codec: exports2.ZodCodec,
      Boolean: exports2.ZodBoolean,
      String: exports2.ZodString
    }, ...args), "stringbool");
    exports2.stringbool = stringbool;
    function json(params) {
      const jsonSchema = lazy(() => {
        return union([string(params), number(), boolean(), _null(), array(jsonSchema), record(string(), jsonSchema)]);
      });
      return jsonSchema;
    }
    __name(json, "json");
    function preprocess(fn, schema) {
      return pipe(transform(fn), schema);
    }
    __name(preprocess, "preprocess");
  }
});

// node_modules/zod/v4/classic/compat.cjs
var require_compat = __commonJS({
  "node_modules/zod/v4/classic/compat.cjs"(exports2) {
    "use strict";
    var __createBinding = exports2 && exports2.__createBinding || (Object.create ? (function(o, m, k, k2) {
      if (k2 === void 0) k2 = k;
      var desc = Object.getOwnPropertyDescriptor(m, k);
      if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
        desc = { enumerable: true, get: /* @__PURE__ */ __name(function() {
          return m[k];
        }, "get") };
      }
      Object.defineProperty(o, k2, desc);
    }) : (function(o, m, k, k2) {
      if (k2 === void 0) k2 = k;
      o[k2] = m[k];
    }));
    var __setModuleDefault = exports2 && exports2.__setModuleDefault || (Object.create ? (function(o, v) {
      Object.defineProperty(o, "default", { enumerable: true, value: v });
    }) : function(o, v) {
      o["default"] = v;
    });
    var __importStar = exports2 && exports2.__importStar || function(mod) {
      if (mod && mod.__esModule) return mod;
      var result = {};
      if (mod != null) {
        for (var k in mod) if (k !== "default" && Object.prototype.hasOwnProperty.call(mod, k)) __createBinding(result, mod, k);
      }
      __setModuleDefault(result, mod);
      return result;
    };
    Object.defineProperty(exports2, "__esModule", { value: true });
    exports2.ZodFirstPartyTypeKind = exports2.config = exports2.$brand = exports2.ZodIssueCode = void 0;
    exports2.setErrorMap = setErrorMap;
    exports2.getErrorMap = getErrorMap;
    var core = __importStar(require_core2());
    exports2.ZodIssueCode = {
      invalid_type: "invalid_type",
      too_big: "too_big",
      too_small: "too_small",
      invalid_format: "invalid_format",
      not_multiple_of: "not_multiple_of",
      unrecognized_keys: "unrecognized_keys",
      invalid_union: "invalid_union",
      invalid_key: "invalid_key",
      invalid_element: "invalid_element",
      invalid_value: "invalid_value",
      custom: "custom"
    };
    var index_js_1 = require_core2();
    Object.defineProperty(exports2, "$brand", { enumerable: true, get: /* @__PURE__ */ __name(function() {
      return index_js_1.$brand;
    }, "get") });
    Object.defineProperty(exports2, "config", { enumerable: true, get: /* @__PURE__ */ __name(function() {
      return index_js_1.config;
    }, "get") });
    function setErrorMap(map) {
      core.config({
        customError: map
      });
    }
    __name(setErrorMap, "setErrorMap");
    function getErrorMap() {
      return core.config().customError;
    }
    __name(getErrorMap, "getErrorMap");
    var ZodFirstPartyTypeKind;
    /* @__PURE__ */ (function(ZodFirstPartyTypeKind2) {
    })(ZodFirstPartyTypeKind || (exports2.ZodFirstPartyTypeKind = ZodFirstPartyTypeKind = {}));
  }
});

// node_modules/zod/v4/classic/from-json-schema.cjs
var require_from_json_schema = __commonJS({
  "node_modules/zod/v4/classic/from-json-schema.cjs"(exports2) {
    "use strict";
    var __createBinding = exports2 && exports2.__createBinding || (Object.create ? (function(o, m, k, k2) {
      if (k2 === void 0) k2 = k;
      var desc = Object.getOwnPropertyDescriptor(m, k);
      if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
        desc = { enumerable: true, get: /* @__PURE__ */ __name(function() {
          return m[k];
        }, "get") };
      }
      Object.defineProperty(o, k2, desc);
    }) : (function(o, m, k, k2) {
      if (k2 === void 0) k2 = k;
      o[k2] = m[k];
    }));
    var __setModuleDefault = exports2 && exports2.__setModuleDefault || (Object.create ? (function(o, v) {
      Object.defineProperty(o, "default", { enumerable: true, value: v });
    }) : function(o, v) {
      o["default"] = v;
    });
    var __importStar = exports2 && exports2.__importStar || function(mod) {
      if (mod && mod.__esModule) return mod;
      var result = {};
      if (mod != null) {
        for (var k in mod) if (k !== "default" && Object.prototype.hasOwnProperty.call(mod, k)) __createBinding(result, mod, k);
      }
      __setModuleDefault(result, mod);
      return result;
    };
    Object.defineProperty(exports2, "__esModule", { value: true });
    exports2.fromJSONSchema = fromJSONSchema;
    var registries_js_1 = require_registries();
    var _checks = __importStar(require_checks2());
    var _iso = __importStar(require_iso());
    var _schemas = __importStar(require_schemas2());
    var z = {
      ..._schemas,
      ..._checks,
      iso: _iso
    };
    var RECOGNIZED_KEYS = /* @__PURE__ */ new Set([
      // Schema identification
      "$schema",
      "$ref",
      "$defs",
      "definitions",
      // Core schema keywords
      "$id",
      "id",
      "$comment",
      "$anchor",
      "$vocabulary",
      "$dynamicRef",
      "$dynamicAnchor",
      // Type
      "type",
      "enum",
      "const",
      // Composition
      "anyOf",
      "oneOf",
      "allOf",
      "not",
      // Object
      "properties",
      "required",
      "additionalProperties",
      "patternProperties",
      "propertyNames",
      "minProperties",
      "maxProperties",
      // Array
      "items",
      "prefixItems",
      "additionalItems",
      "minItems",
      "maxItems",
      "uniqueItems",
      "contains",
      "minContains",
      "maxContains",
      // String
      "minLength",
      "maxLength",
      "pattern",
      "format",
      // Number
      "minimum",
      "maximum",
      "exclusiveMinimum",
      "exclusiveMaximum",
      "multipleOf",
      // Already handled metadata
      "description",
      "default",
      // Content
      "contentEncoding",
      "contentMediaType",
      "contentSchema",
      // Unsupported (error-throwing)
      "unevaluatedItems",
      "unevaluatedProperties",
      "if",
      "then",
      "else",
      "dependentSchemas",
      "dependentRequired",
      // OpenAPI
      "nullable",
      "readOnly"
    ]);
    function detectVersion(schema, defaultTarget) {
      const $schema = schema.$schema;
      if ($schema === "https://json-schema.org/draft/2020-12/schema") {
        return "draft-2020-12";
      }
      if ($schema === "http://json-schema.org/draft-07/schema#") {
        return "draft-7";
      }
      if ($schema === "http://json-schema.org/draft-04/schema#") {
        return "draft-4";
      }
      return defaultTarget ?? "draft-2020-12";
    }
    __name(detectVersion, "detectVersion");
    function resolveRef(ref, ctx) {
      if (!ref.startsWith("#")) {
        throw new Error("External $ref is not supported, only local refs (#/...) are allowed");
      }
      const path5 = ref.slice(1).split("/").filter(Boolean);
      if (path5.length === 0) {
        return ctx.rootSchema;
      }
      const defsKey = ctx.version === "draft-2020-12" ? "$defs" : "definitions";
      if (path5[0] === defsKey) {
        const key = path5[1];
        if (!key || !ctx.defs[key]) {
          throw new Error(`Reference not found: ${ref}`);
        }
        return ctx.defs[key];
      }
      throw new Error(`Reference not found: ${ref}`);
    }
    __name(resolveRef, "resolveRef");
    function convertBaseSchema(schema, ctx) {
      if (schema.not !== void 0) {
        if (typeof schema.not === "object" && Object.keys(schema.not).length === 0) {
          return z.never();
        }
        throw new Error("not is not supported in Zod (except { not: {} } for never)");
      }
      if (schema.unevaluatedItems !== void 0) {
        throw new Error("unevaluatedItems is not supported");
      }
      if (schema.unevaluatedProperties !== void 0) {
        throw new Error("unevaluatedProperties is not supported");
      }
      if (schema.if !== void 0 || schema.then !== void 0 || schema.else !== void 0) {
        throw new Error("Conditional schemas (if/then/else) are not supported");
      }
      if (schema.dependentSchemas !== void 0 || schema.dependentRequired !== void 0) {
        throw new Error("dependentSchemas and dependentRequired are not supported");
      }
      if (schema.$ref) {
        const refPath = schema.$ref;
        if (ctx.refs.has(refPath)) {
          return ctx.refs.get(refPath);
        }
        if (ctx.processing.has(refPath)) {
          return z.lazy(() => {
            if (!ctx.refs.has(refPath)) {
              throw new Error(`Circular reference not resolved: ${refPath}`);
            }
            return ctx.refs.get(refPath);
          });
        }
        ctx.processing.add(refPath);
        const resolved = resolveRef(refPath, ctx);
        const zodSchema2 = convertSchema(resolved, ctx);
        ctx.refs.set(refPath, zodSchema2);
        ctx.processing.delete(refPath);
        return zodSchema2;
      }
      if (schema.enum !== void 0) {
        const enumValues = schema.enum;
        if (ctx.version === "openapi-3.0" && schema.nullable === true && enumValues.length === 1 && enumValues[0] === null) {
          return z.null();
        }
        if (enumValues.length === 0) {
          return z.never();
        }
        if (enumValues.length === 1) {
          return z.literal(enumValues[0]);
        }
        if (enumValues.every((v) => typeof v === "string")) {
          return z.enum(enumValues);
        }
        const literalSchemas = enumValues.map((v) => z.literal(v));
        if (literalSchemas.length < 2) {
          return literalSchemas[0];
        }
        return z.union([literalSchemas[0], literalSchemas[1], ...literalSchemas.slice(2)]);
      }
      if (schema.const !== void 0) {
        return z.literal(schema.const);
      }
      const type = schema.type;
      if (Array.isArray(type)) {
        const typeSchemas = type.map((t) => {
          const typeSchema = { ...schema, type: t };
          return convertBaseSchema(typeSchema, ctx);
        });
        if (typeSchemas.length === 0) {
          return z.never();
        }
        if (typeSchemas.length === 1) {
          return typeSchemas[0];
        }
        return z.union(typeSchemas);
      }
      if (!type) {
        return z.any();
      }
      let zodSchema;
      switch (type) {
        case "string": {
          let stringSchema = z.string();
          if (schema.format) {
            const format = schema.format;
            if (format === "email") {
              stringSchema = stringSchema.check(z.email());
            } else if (format === "uri" || format === "uri-reference") {
              stringSchema = stringSchema.check(z.url());
            } else if (format === "uuid" || format === "guid") {
              stringSchema = stringSchema.check(z.uuid());
            } else if (format === "date-time") {
              stringSchema = stringSchema.check(z.iso.datetime());
            } else if (format === "date") {
              stringSchema = stringSchema.check(z.iso.date());
            } else if (format === "time") {
              stringSchema = stringSchema.check(z.iso.time());
            } else if (format === "duration") {
              stringSchema = stringSchema.check(z.iso.duration());
            } else if (format === "ipv4") {
              stringSchema = stringSchema.check(z.ipv4());
            } else if (format === "ipv6") {
              stringSchema = stringSchema.check(z.ipv6());
            } else if (format === "mac") {
              stringSchema = stringSchema.check(z.mac());
            } else if (format === "cidr") {
              stringSchema = stringSchema.check(z.cidrv4());
            } else if (format === "cidr-v6") {
              stringSchema = stringSchema.check(z.cidrv6());
            } else if (format === "base64") {
              stringSchema = stringSchema.check(z.base64());
            } else if (format === "base64url") {
              stringSchema = stringSchema.check(z.base64url());
            } else if (format === "e164") {
              stringSchema = stringSchema.check(z.e164());
            } else if (format === "jwt") {
              stringSchema = stringSchema.check(z.jwt());
            } else if (format === "emoji") {
              stringSchema = stringSchema.check(z.emoji());
            } else if (format === "nanoid") {
              stringSchema = stringSchema.check(z.nanoid());
            } else if (format === "cuid") {
              stringSchema = stringSchema.check(z.cuid());
            } else if (format === "cuid2") {
              stringSchema = stringSchema.check(z.cuid2());
            } else if (format === "ulid") {
              stringSchema = stringSchema.check(z.ulid());
            } else if (format === "xid") {
              stringSchema = stringSchema.check(z.xid());
            } else if (format === "ksuid") {
              stringSchema = stringSchema.check(z.ksuid());
            }
          }
          if (typeof schema.minLength === "number") {
            stringSchema = stringSchema.min(schema.minLength);
          }
          if (typeof schema.maxLength === "number") {
            stringSchema = stringSchema.max(schema.maxLength);
          }
          if (schema.pattern) {
            stringSchema = stringSchema.regex(new RegExp(schema.pattern));
          }
          zodSchema = stringSchema;
          break;
        }
        case "number":
        case "integer": {
          let numberSchema = type === "integer" ? z.number().int() : z.number();
          if (typeof schema.minimum === "number") {
            numberSchema = numberSchema.min(schema.minimum);
          }
          if (typeof schema.maximum === "number") {
            numberSchema = numberSchema.max(schema.maximum);
          }
          if (typeof schema.exclusiveMinimum === "number") {
            numberSchema = numberSchema.gt(schema.exclusiveMinimum);
          } else if (schema.exclusiveMinimum === true && typeof schema.minimum === "number") {
            numberSchema = numberSchema.gt(schema.minimum);
          }
          if (typeof schema.exclusiveMaximum === "number") {
            numberSchema = numberSchema.lt(schema.exclusiveMaximum);
          } else if (schema.exclusiveMaximum === true && typeof schema.maximum === "number") {
            numberSchema = numberSchema.lt(schema.maximum);
          }
          if (typeof schema.multipleOf === "number") {
            numberSchema = numberSchema.multipleOf(schema.multipleOf);
          }
          zodSchema = numberSchema;
          break;
        }
        case "boolean": {
          zodSchema = z.boolean();
          break;
        }
        case "null": {
          zodSchema = z.null();
          break;
        }
        case "object": {
          const shape = {};
          const properties = schema.properties || {};
          const requiredSet = new Set(schema.required || []);
          for (const [key, propSchema] of Object.entries(properties)) {
            const propZodSchema = convertSchema(propSchema, ctx);
            shape[key] = requiredSet.has(key) ? propZodSchema : propZodSchema.optional();
          }
          if (schema.propertyNames) {
            const keySchema = convertSchema(schema.propertyNames, ctx);
            const valueSchema = schema.additionalProperties && typeof schema.additionalProperties === "object" ? convertSchema(schema.additionalProperties, ctx) : z.any();
            if (Object.keys(shape).length === 0) {
              zodSchema = z.record(keySchema, valueSchema);
              break;
            }
            const objectSchema2 = z.object(shape).passthrough();
            const recordSchema = z.looseRecord(keySchema, valueSchema);
            zodSchema = z.intersection(objectSchema2, recordSchema);
            break;
          }
          if (schema.patternProperties) {
            const patternProps = schema.patternProperties;
            const patternKeys = Object.keys(patternProps);
            const looseRecords = [];
            for (const pattern of patternKeys) {
              const patternValue = convertSchema(patternProps[pattern], ctx);
              const keySchema = z.string().regex(new RegExp(pattern));
              looseRecords.push(z.looseRecord(keySchema, patternValue));
            }
            const schemasToIntersect = [];
            if (Object.keys(shape).length > 0) {
              schemasToIntersect.push(z.object(shape).passthrough());
            }
            schemasToIntersect.push(...looseRecords);
            if (schemasToIntersect.length === 0) {
              zodSchema = z.object({}).passthrough();
            } else if (schemasToIntersect.length === 1) {
              zodSchema = schemasToIntersect[0];
            } else {
              let result = z.intersection(schemasToIntersect[0], schemasToIntersect[1]);
              for (let i = 2; i < schemasToIntersect.length; i++) {
                result = z.intersection(result, schemasToIntersect[i]);
              }
              zodSchema = result;
            }
            break;
          }
          const objectSchema = z.object(shape);
          if (schema.additionalProperties === false) {
            zodSchema = objectSchema.strict();
          } else if (typeof schema.additionalProperties === "object") {
            zodSchema = objectSchema.catchall(convertSchema(schema.additionalProperties, ctx));
          } else {
            zodSchema = objectSchema.passthrough();
          }
          break;
        }
        case "array": {
          const prefixItems = schema.prefixItems;
          const items = schema.items;
          if (prefixItems && Array.isArray(prefixItems)) {
            const tupleItems = prefixItems.map((item) => convertSchema(item, ctx));
            const rest = items && typeof items === "object" && !Array.isArray(items) ? convertSchema(items, ctx) : void 0;
            if (rest) {
              zodSchema = z.tuple(tupleItems).rest(rest);
            } else {
              zodSchema = z.tuple(tupleItems);
            }
            if (typeof schema.minItems === "number") {
              zodSchema = zodSchema.check(z.minLength(schema.minItems));
            }
            if (typeof schema.maxItems === "number") {
              zodSchema = zodSchema.check(z.maxLength(schema.maxItems));
            }
          } else if (Array.isArray(items)) {
            const tupleItems = items.map((item) => convertSchema(item, ctx));
            const rest = schema.additionalItems && typeof schema.additionalItems === "object" ? convertSchema(schema.additionalItems, ctx) : void 0;
            if (rest) {
              zodSchema = z.tuple(tupleItems).rest(rest);
            } else {
              zodSchema = z.tuple(tupleItems);
            }
            if (typeof schema.minItems === "number") {
              zodSchema = zodSchema.check(z.minLength(schema.minItems));
            }
            if (typeof schema.maxItems === "number") {
              zodSchema = zodSchema.check(z.maxLength(schema.maxItems));
            }
          } else if (items !== void 0) {
            const element = convertSchema(items, ctx);
            let arraySchema = z.array(element);
            if (typeof schema.minItems === "number") {
              arraySchema = arraySchema.min(schema.minItems);
            }
            if (typeof schema.maxItems === "number") {
              arraySchema = arraySchema.max(schema.maxItems);
            }
            zodSchema = arraySchema;
          } else {
            zodSchema = z.array(z.any());
          }
          break;
        }
        default:
          throw new Error(`Unsupported type: ${type}`);
      }
      if (schema.description) {
        zodSchema = zodSchema.describe(schema.description);
      }
      if (schema.default !== void 0) {
        zodSchema = zodSchema.default(schema.default);
      }
      return zodSchema;
    }
    __name(convertBaseSchema, "convertBaseSchema");
    function convertSchema(schema, ctx) {
      if (typeof schema === "boolean") {
        return schema ? z.any() : z.never();
      }
      let baseSchema = convertBaseSchema(schema, ctx);
      const hasExplicitType = schema.type || schema.enum !== void 0 || schema.const !== void 0;
      if (schema.anyOf && Array.isArray(schema.anyOf)) {
        const options = schema.anyOf.map((s) => convertSchema(s, ctx));
        const anyOfUnion = z.union(options);
        baseSchema = hasExplicitType ? z.intersection(baseSchema, anyOfUnion) : anyOfUnion;
      }
      if (schema.oneOf && Array.isArray(schema.oneOf)) {
        const options = schema.oneOf.map((s) => convertSchema(s, ctx));
        const oneOfUnion = z.xor(options);
        baseSchema = hasExplicitType ? z.intersection(baseSchema, oneOfUnion) : oneOfUnion;
      }
      if (schema.allOf && Array.isArray(schema.allOf)) {
        if (schema.allOf.length === 0) {
          baseSchema = hasExplicitType ? baseSchema : z.any();
        } else {
          let result = hasExplicitType ? baseSchema : convertSchema(schema.allOf[0], ctx);
          const startIdx = hasExplicitType ? 0 : 1;
          for (let i = startIdx; i < schema.allOf.length; i++) {
            result = z.intersection(result, convertSchema(schema.allOf[i], ctx));
          }
          baseSchema = result;
        }
      }
      if (schema.nullable === true && ctx.version === "openapi-3.0") {
        baseSchema = z.nullable(baseSchema);
      }
      if (schema.readOnly === true) {
        baseSchema = z.readonly(baseSchema);
      }
      const extraMeta = {};
      const coreMetadataKeys = ["$id", "id", "$comment", "$anchor", "$vocabulary", "$dynamicRef", "$dynamicAnchor"];
      for (const key of coreMetadataKeys) {
        if (key in schema) {
          extraMeta[key] = schema[key];
        }
      }
      const contentMetadataKeys = ["contentEncoding", "contentMediaType", "contentSchema"];
      for (const key of contentMetadataKeys) {
        if (key in schema) {
          extraMeta[key] = schema[key];
        }
      }
      for (const key of Object.keys(schema)) {
        if (!RECOGNIZED_KEYS.has(key)) {
          extraMeta[key] = schema[key];
        }
      }
      if (Object.keys(extraMeta).length > 0) {
        ctx.registry.add(baseSchema, extraMeta);
      }
      return baseSchema;
    }
    __name(convertSchema, "convertSchema");
    function fromJSONSchema(schema, params) {
      if (typeof schema === "boolean") {
        return schema ? z.any() : z.never();
      }
      const version = detectVersion(schema, params?.defaultTarget);
      const defs = schema.$defs || schema.definitions || {};
      const ctx = {
        version,
        defs,
        refs: /* @__PURE__ */ new Map(),
        processing: /* @__PURE__ */ new Set(),
        rootSchema: schema,
        registry: params?.registry ?? registries_js_1.globalRegistry
      };
      return convertSchema(schema, ctx);
    }
    __name(fromJSONSchema, "fromJSONSchema");
  }
});

// node_modules/zod/v4/classic/coerce.cjs
var require_coerce = __commonJS({
  "node_modules/zod/v4/classic/coerce.cjs"(exports2) {
    "use strict";
    var __createBinding = exports2 && exports2.__createBinding || (Object.create ? (function(o, m, k, k2) {
      if (k2 === void 0) k2 = k;
      var desc = Object.getOwnPropertyDescriptor(m, k);
      if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
        desc = { enumerable: true, get: /* @__PURE__ */ __name(function() {
          return m[k];
        }, "get") };
      }
      Object.defineProperty(o, k2, desc);
    }) : (function(o, m, k, k2) {
      if (k2 === void 0) k2 = k;
      o[k2] = m[k];
    }));
    var __setModuleDefault = exports2 && exports2.__setModuleDefault || (Object.create ? (function(o, v) {
      Object.defineProperty(o, "default", { enumerable: true, value: v });
    }) : function(o, v) {
      o["default"] = v;
    });
    var __importStar = exports2 && exports2.__importStar || function(mod) {
      if (mod && mod.__esModule) return mod;
      var result = {};
      if (mod != null) {
        for (var k in mod) if (k !== "default" && Object.prototype.hasOwnProperty.call(mod, k)) __createBinding(result, mod, k);
      }
      __setModuleDefault(result, mod);
      return result;
    };
    Object.defineProperty(exports2, "__esModule", { value: true });
    exports2.string = string;
    exports2.number = number;
    exports2.boolean = boolean;
    exports2.bigint = bigint;
    exports2.date = date;
    var core = __importStar(require_core2());
    var schemas = __importStar(require_schemas2());
    function string(params) {
      return core._coercedString(schemas.ZodString, params);
    }
    __name(string, "string");
    function number(params) {
      return core._coercedNumber(schemas.ZodNumber, params);
    }
    __name(number, "number");
    function boolean(params) {
      return core._coercedBoolean(schemas.ZodBoolean, params);
    }
    __name(boolean, "boolean");
    function bigint(params) {
      return core._coercedBigint(schemas.ZodBigInt, params);
    }
    __name(bigint, "bigint");
    function date(params) {
      return core._coercedDate(schemas.ZodDate, params);
    }
    __name(date, "date");
  }
});

// node_modules/zod/v4/classic/external.cjs
var require_external = __commonJS({
  "node_modules/zod/v4/classic/external.cjs"(exports2) {
    "use strict";
    var __createBinding = exports2 && exports2.__createBinding || (Object.create ? (function(o, m, k, k2) {
      if (k2 === void 0) k2 = k;
      var desc = Object.getOwnPropertyDescriptor(m, k);
      if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
        desc = { enumerable: true, get: /* @__PURE__ */ __name(function() {
          return m[k];
        }, "get") };
      }
      Object.defineProperty(o, k2, desc);
    }) : (function(o, m, k, k2) {
      if (k2 === void 0) k2 = k;
      o[k2] = m[k];
    }));
    var __setModuleDefault = exports2 && exports2.__setModuleDefault || (Object.create ? (function(o, v) {
      Object.defineProperty(o, "default", { enumerable: true, value: v });
    }) : function(o, v) {
      o["default"] = v;
    });
    var __importStar = exports2 && exports2.__importStar || function(mod) {
      if (mod && mod.__esModule) return mod;
      var result = {};
      if (mod != null) {
        for (var k in mod) if (k !== "default" && Object.prototype.hasOwnProperty.call(mod, k)) __createBinding(result, mod, k);
      }
      __setModuleDefault(result, mod);
      return result;
    };
    var __exportStar = exports2 && exports2.__exportStar || function(m, exports3) {
      for (var p in m) if (p !== "default" && !Object.prototype.hasOwnProperty.call(exports3, p)) __createBinding(exports3, m, p);
    };
    var __importDefault = exports2 && exports2.__importDefault || function(mod) {
      return mod && mod.__esModule ? mod : { "default": mod };
    };
    Object.defineProperty(exports2, "__esModule", { value: true });
    exports2.coerce = exports2.iso = exports2.ZodISODuration = exports2.ZodISOTime = exports2.ZodISODate = exports2.ZodISODateTime = exports2.locales = exports2.fromJSONSchema = exports2.toJSONSchema = exports2.NEVER = exports2.util = exports2.TimePrecision = exports2.flattenError = exports2.formatError = exports2.prettifyError = exports2.treeifyError = exports2.regexes = exports2.clone = exports2.$brand = exports2.$input = exports2.$output = exports2.config = exports2.registry = exports2.globalRegistry = exports2.core = void 0;
    exports2.core = __importStar(require_core2());
    __exportStar(require_schemas2(), exports2);
    __exportStar(require_checks2(), exports2);
    __exportStar(require_errors3(), exports2);
    __exportStar(require_parse2(), exports2);
    __exportStar(require_compat(), exports2);
    var index_js_1 = require_core2();
    var en_js_1 = __importDefault(require_en());
    (0, index_js_1.config)((0, en_js_1.default)());
    var index_js_2 = require_core2();
    Object.defineProperty(exports2, "globalRegistry", { enumerable: true, get: /* @__PURE__ */ __name(function() {
      return index_js_2.globalRegistry;
    }, "get") });
    Object.defineProperty(exports2, "registry", { enumerable: true, get: /* @__PURE__ */ __name(function() {
      return index_js_2.registry;
    }, "get") });
    Object.defineProperty(exports2, "config", { enumerable: true, get: /* @__PURE__ */ __name(function() {
      return index_js_2.config;
    }, "get") });
    Object.defineProperty(exports2, "$output", { enumerable: true, get: /* @__PURE__ */ __name(function() {
      return index_js_2.$output;
    }, "get") });
    Object.defineProperty(exports2, "$input", { enumerable: true, get: /* @__PURE__ */ __name(function() {
      return index_js_2.$input;
    }, "get") });
    Object.defineProperty(exports2, "$brand", { enumerable: true, get: /* @__PURE__ */ __name(function() {
      return index_js_2.$brand;
    }, "get") });
    Object.defineProperty(exports2, "clone", { enumerable: true, get: /* @__PURE__ */ __name(function() {
      return index_js_2.clone;
    }, "get") });
    Object.defineProperty(exports2, "regexes", { enumerable: true, get: /* @__PURE__ */ __name(function() {
      return index_js_2.regexes;
    }, "get") });
    Object.defineProperty(exports2, "treeifyError", { enumerable: true, get: /* @__PURE__ */ __name(function() {
      return index_js_2.treeifyError;
    }, "get") });
    Object.defineProperty(exports2, "prettifyError", { enumerable: true, get: /* @__PURE__ */ __name(function() {
      return index_js_2.prettifyError;
    }, "get") });
    Object.defineProperty(exports2, "formatError", { enumerable: true, get: /* @__PURE__ */ __name(function() {
      return index_js_2.formatError;
    }, "get") });
    Object.defineProperty(exports2, "flattenError", { enumerable: true, get: /* @__PURE__ */ __name(function() {
      return index_js_2.flattenError;
    }, "get") });
    Object.defineProperty(exports2, "TimePrecision", { enumerable: true, get: /* @__PURE__ */ __name(function() {
      return index_js_2.TimePrecision;
    }, "get") });
    Object.defineProperty(exports2, "util", { enumerable: true, get: /* @__PURE__ */ __name(function() {
      return index_js_2.util;
    }, "get") });
    Object.defineProperty(exports2, "NEVER", { enumerable: true, get: /* @__PURE__ */ __name(function() {
      return index_js_2.NEVER;
    }, "get") });
    var json_schema_processors_js_1 = require_json_schema_processors();
    Object.defineProperty(exports2, "toJSONSchema", { enumerable: true, get: /* @__PURE__ */ __name(function() {
      return json_schema_processors_js_1.toJSONSchema;
    }, "get") });
    var from_json_schema_js_1 = require_from_json_schema();
    Object.defineProperty(exports2, "fromJSONSchema", { enumerable: true, get: /* @__PURE__ */ __name(function() {
      return from_json_schema_js_1.fromJSONSchema;
    }, "get") });
    exports2.locales = __importStar(require_locales());
    var iso_js_1 = require_iso();
    Object.defineProperty(exports2, "ZodISODateTime", { enumerable: true, get: /* @__PURE__ */ __name(function() {
      return iso_js_1.ZodISODateTime;
    }, "get") });
    Object.defineProperty(exports2, "ZodISODate", { enumerable: true, get: /* @__PURE__ */ __name(function() {
      return iso_js_1.ZodISODate;
    }, "get") });
    Object.defineProperty(exports2, "ZodISOTime", { enumerable: true, get: /* @__PURE__ */ __name(function() {
      return iso_js_1.ZodISOTime;
    }, "get") });
    Object.defineProperty(exports2, "ZodISODuration", { enumerable: true, get: /* @__PURE__ */ __name(function() {
      return iso_js_1.ZodISODuration;
    }, "get") });
    exports2.iso = __importStar(require_iso());
    exports2.coerce = __importStar(require_coerce());
  }
});

// node_modules/zod/index.cjs
var require_zod = __commonJS({
  "node_modules/zod/index.cjs"(exports2) {
    "use strict";
    var __createBinding = exports2 && exports2.__createBinding || (Object.create ? (function(o, m, k, k2) {
      if (k2 === void 0) k2 = k;
      var desc = Object.getOwnPropertyDescriptor(m, k);
      if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
        desc = { enumerable: true, get: /* @__PURE__ */ __name(function() {
          return m[k];
        }, "get") };
      }
      Object.defineProperty(o, k2, desc);
    }) : (function(o, m, k, k2) {
      if (k2 === void 0) k2 = k;
      o[k2] = m[k];
    }));
    var __setModuleDefault = exports2 && exports2.__setModuleDefault || (Object.create ? (function(o, v) {
      Object.defineProperty(o, "default", { enumerable: true, value: v });
    }) : function(o, v) {
      o["default"] = v;
    });
    var __importStar = exports2 && exports2.__importStar || function(mod) {
      if (mod && mod.__esModule) return mod;
      var result = {};
      if (mod != null) {
        for (var k in mod) if (k !== "default" && Object.prototype.hasOwnProperty.call(mod, k)) __createBinding(result, mod, k);
      }
      __setModuleDefault(result, mod);
      return result;
    };
    var __exportStar = exports2 && exports2.__exportStar || function(m, exports3) {
      for (var p in m) if (p !== "default" && !Object.prototype.hasOwnProperty.call(exports3, p)) __createBinding(exports3, m, p);
    };
    Object.defineProperty(exports2, "__esModule", { value: true });
    exports2.z = void 0;
    var z = __importStar(require_external());
    exports2.z = z;
    __exportStar(require_external(), exports2);
    exports2.default = z;
  }
});

// node_modules/@acontext/acontext/dist/types/common.js
var require_common = __commonJS({
  "node_modules/@acontext/acontext/dist/types/common.js"(exports2) {
    "use strict";
    Object.defineProperty(exports2, "__esModule", { value: true });
    exports2.FlagResponseSchema = exports2.FileContentSchema = void 0;
    var zod_1 = require_zod();
    exports2.FileContentSchema = zod_1.z.object({
      type: zod_1.z.string(),
      raw: zod_1.z.string()
    });
    exports2.FlagResponseSchema = zod_1.z.object({
      status: zod_1.z.number(),
      errmsg: zod_1.z.string()
    });
  }
});

// node_modules/@acontext/acontext/dist/types/session.js
var require_session = __commonJS({
  "node_modules/@acontext/acontext/dist/types/session.js"(exports2) {
    "use strict";
    Object.defineProperty(exports2, "__esModule", { value: true });
    exports2.EditStrategySchema = exports2.MiddleOutStrategySchema = exports2.MiddleOutParamsSchema = exports2.TokenLimitStrategySchema = exports2.TokenLimitParamsSchema = exports2.RemoveToolResultStrategySchema = exports2.RemoveToolCallParamsStrategySchema = exports2.RemoveToolCallParamsParamsSchema = exports2.RemoveToolResultParamsSchema = exports2.CopySessionResultSchema = exports2.MessageObservingStatusSchema = exports2.TokenCountsSchema = exports2.GetTasksOutputSchema = exports2.GetMessagesOutputSchema = exports2.ListEventsOutputSchema = exports2.SessionEventSchema = exports2.PublicURLSchema = exports2.ListSessionsOutputSchema = exports2.TaskSchema = exports2.TaskDataSchema = exports2.SessionSchema = exports2.MessageSchema = exports2.PartSchema = exports2.AssetSchema = void 0;
    var zod_1 = require_zod();
    exports2.AssetSchema = zod_1.z.object({
      bucket: zod_1.z.string(),
      s3_key: zod_1.z.string(),
      etag: zod_1.z.string(),
      sha256: zod_1.z.string(),
      mime: zod_1.z.string(),
      size_b: zod_1.z.number()
    });
    exports2.PartSchema = zod_1.z.object({
      type: zod_1.z.string(),
      text: zod_1.z.string().nullable().optional(),
      asset: exports2.AssetSchema.nullable().optional(),
      filename: zod_1.z.string().nullable().optional(),
      meta: zod_1.z.record(zod_1.z.string(), zod_1.z.unknown()).nullable().optional()
    });
    exports2.MessageSchema = zod_1.z.object({
      id: zod_1.z.string(),
      session_id: zod_1.z.string(),
      parent_id: zod_1.z.string().nullable(),
      role: zod_1.z.string(),
      meta: zod_1.z.record(zod_1.z.string(), zod_1.z.unknown()),
      parts: zod_1.z.array(exports2.PartSchema),
      task_id: zod_1.z.string().nullable(),
      /** Task process status: 'success' | 'failed' | 'running' | 'pending' | 'disable_tracking' | 'limit_exceed' */
      session_task_process_status: zod_1.z.string(),
      created_at: zod_1.z.string(),
      updated_at: zod_1.z.string()
    });
    exports2.SessionSchema = zod_1.z.object({
      id: zod_1.z.string(),
      project_id: zod_1.z.string(),
      user_id: zod_1.z.string().nullable().optional(),
      disable_task_tracking: zod_1.z.boolean(),
      configs: zod_1.z.record(zod_1.z.string(), zod_1.z.unknown()).nullable(),
      created_at: zod_1.z.string(),
      updated_at: zod_1.z.string()
    });
    exports2.TaskDataSchema = zod_1.z.object({
      task_description: zod_1.z.string(),
      progresses: zod_1.z.array(zod_1.z.string()).nullable().optional(),
      user_preferences: zod_1.z.array(zod_1.z.string()).nullable().optional()
    });
    exports2.TaskSchema = zod_1.z.object({
      id: zod_1.z.string(),
      session_id: zod_1.z.string(),
      project_id: zod_1.z.string(),
      order: zod_1.z.number(),
      data: exports2.TaskDataSchema,
      status: zod_1.z.string(),
      is_planning: zod_1.z.boolean(),
      created_at: zod_1.z.string(),
      updated_at: zod_1.z.string()
    });
    exports2.ListSessionsOutputSchema = zod_1.z.object({
      items: zod_1.z.array(exports2.SessionSchema),
      next_cursor: zod_1.z.string().nullable().optional(),
      has_more: zod_1.z.boolean()
    });
    exports2.PublicURLSchema = zod_1.z.object({
      url: zod_1.z.string(),
      expire_at: zod_1.z.string()
    });
    exports2.SessionEventSchema = zod_1.z.object({
      id: zod_1.z.string(),
      session_id: zod_1.z.string(),
      project_id: zod_1.z.string(),
      type: zod_1.z.string(),
      data: zod_1.z.record(zod_1.z.string(), zod_1.z.unknown()),
      created_at: zod_1.z.string(),
      updated_at: zod_1.z.string()
    });
    exports2.ListEventsOutputSchema = zod_1.z.object({
      items: zod_1.z.array(exports2.SessionEventSchema),
      next_cursor: zod_1.z.string().nullable().optional(),
      has_more: zod_1.z.boolean()
    });
    exports2.GetMessagesOutputSchema = zod_1.z.object({
      items: zod_1.z.array(zod_1.z.unknown()),
      ids: zod_1.z.array(zod_1.z.string()),
      /** User-provided metadata for each message (same order as items/ids) */
      metas: zod_1.z.array(zod_1.z.record(zod_1.z.string(), zod_1.z.unknown())).default([]),
      next_cursor: zod_1.z.string().nullable().optional(),
      has_more: zod_1.z.boolean(),
      /** Total token count of the returned messages */
      this_time_tokens: zod_1.z.number(),
      public_urls: zod_1.z.record(zod_1.z.string(), exports2.PublicURLSchema).nullable().optional(),
      /**
       * The message ID where edit strategies were applied up to.
       * If pin_editing_strategies_at_message was provided, this equals that value.
       * Otherwise, this is the ID of the last message in the response.
       * Use this value to maintain prompt cache stability by passing it as
       * pin_editing_strategies_at_message in subsequent requests.
       */
      edit_at_message_id: zod_1.z.string().nullable().optional(),
      /** Session events within the messages time window (only when withEvents is true) */
      events: zod_1.z.array(exports2.SessionEventSchema).nullable().optional()
    });
    exports2.GetTasksOutputSchema = zod_1.z.object({
      items: zod_1.z.array(exports2.TaskSchema),
      next_cursor: zod_1.z.string().nullable().optional(),
      has_more: zod_1.z.boolean()
    });
    exports2.TokenCountsSchema = zod_1.z.object({
      total_tokens: zod_1.z.number()
    });
    exports2.MessageObservingStatusSchema = zod_1.z.object({
      observed: zod_1.z.number(),
      in_process: zod_1.z.number(),
      pending: zod_1.z.number(),
      updated_at: zod_1.z.string()
    });
    exports2.CopySessionResultSchema = zod_1.z.object({
      old_session_id: zod_1.z.string(),
      new_session_id: zod_1.z.string()
    });
    exports2.RemoveToolResultParamsSchema = zod_1.z.object({
      /**
       * Number of most recent tool results to keep with original content.
       * @default 3
       */
      keep_recent_n_tool_results: zod_1.z.number().optional(),
      /**
       * Custom text to replace old tool results with.
       * @default "Done"
       */
      tool_result_placeholder: zod_1.z.string().optional(),
      /**
       * List of tool names that should never have their results removed.
       * Tool results from these tools are always kept regardless of keep_recent_n_tool_results.
       */
      keep_tools: zod_1.z.array(zod_1.z.string()).optional(),
      /**
       * Only remove tool results whose text has more than this many tokens.
       * If omitted, all tool results are eligible for removal.
       */
      gt_token: zod_1.z.number().int().min(1).optional()
    });
    exports2.RemoveToolCallParamsParamsSchema = zod_1.z.object({
      /**
       * Number of most recent tool calls to keep with full parameters.
       * @default 3
       */
      keep_recent_n_tool_calls: zod_1.z.number().optional(),
      /**
       * List of tool names that should never have their parameters removed.
       * Tool calls for these tools always keep their full parameters regardless of keep_recent_n_tool_calls.
       */
      keep_tools: zod_1.z.array(zod_1.z.string()).optional(),
      /**
       * Only remove tool call params whose arguments have more than this many tokens.
       * If omitted, all tool calls are eligible for removal.
       */
      gt_token: zod_1.z.number().int().min(1).optional()
    });
    exports2.RemoveToolCallParamsStrategySchema = zod_1.z.object({
      type: zod_1.z.literal("remove_tool_call_params"),
      params: exports2.RemoveToolCallParamsParamsSchema
    });
    exports2.RemoveToolResultStrategySchema = zod_1.z.object({
      type: zod_1.z.literal("remove_tool_result"),
      params: exports2.RemoveToolResultParamsSchema
    });
    exports2.TokenLimitParamsSchema = zod_1.z.object({
      /**
       * Maximum number of tokens to keep. Required parameter.
       * Messages will be removed from oldest to newest until total tokens <= limit_tokens.
       * Tool-call and tool-result pairs are always removed together.
       */
      limit_tokens: zod_1.z.number()
    });
    exports2.TokenLimitStrategySchema = zod_1.z.object({
      type: zod_1.z.literal("token_limit"),
      params: exports2.TokenLimitParamsSchema
    });
    exports2.MiddleOutParamsSchema = zod_1.z.object({
      token_reduce_to: zod_1.z.number()
    });
    exports2.MiddleOutStrategySchema = zod_1.z.object({
      type: zod_1.z.literal("middle_out"),
      params: exports2.MiddleOutParamsSchema
    });
    exports2.EditStrategySchema = zod_1.z.union([
      exports2.RemoveToolResultStrategySchema,
      exports2.RemoveToolCallParamsStrategySchema,
      exports2.TokenLimitStrategySchema,
      exports2.MiddleOutStrategySchema
    ]);
  }
});

// node_modules/@acontext/acontext/dist/types/disk.js
var require_disk = __commonJS({
  "node_modules/@acontext/acontext/dist/types/disk.js"(exports2) {
    "use strict";
    Object.defineProperty(exports2, "__esModule", { value: true });
    exports2.UpdateArtifactRespSchema = exports2.ListArtifactsRespSchema = exports2.GetArtifactRespSchema = exports2.ArtifactsSchema = exports2.ArtifactSchema = exports2.ListDisksOutputSchema = exports2.DiskSchema = void 0;
    var zod_1 = require_zod();
    var common_1 = require_common();
    exports2.DiskSchema = zod_1.z.object({
      id: zod_1.z.string(),
      project_id: zod_1.z.string(),
      user_id: zod_1.z.string().nullable().optional(),
      created_at: zod_1.z.string(),
      updated_at: zod_1.z.string()
    });
    exports2.ListDisksOutputSchema = zod_1.z.object({
      items: zod_1.z.array(exports2.DiskSchema),
      next_cursor: zod_1.z.string().nullable().optional(),
      has_more: zod_1.z.boolean()
    });
    exports2.ArtifactSchema = zod_1.z.object({
      disk_id: zod_1.z.string(),
      path: zod_1.z.string(),
      filename: zod_1.z.string(),
      meta: zod_1.z.record(zod_1.z.string(), zod_1.z.unknown()),
      created_at: zod_1.z.string(),
      updated_at: zod_1.z.string()
    });
    exports2.ArtifactsSchema = zod_1.z.array(exports2.ArtifactSchema);
    exports2.GetArtifactRespSchema = zod_1.z.object({
      artifact: exports2.ArtifactSchema,
      public_url: zod_1.z.string().nullable().optional(),
      content: common_1.FileContentSchema.nullable().optional()
    });
    exports2.ListArtifactsRespSchema = zod_1.z.object({
      artifacts: exports2.ArtifactsSchema,
      directories: zod_1.z.array(zod_1.z.string())
    });
    exports2.UpdateArtifactRespSchema = zod_1.z.object({
      artifact: exports2.ArtifactSchema
    });
  }
});

// node_modules/@acontext/acontext/dist/types/skill.js
var require_skill = __commonJS({
  "node_modules/@acontext/acontext/dist/types/skill.js"(exports2) {
    "use strict";
    Object.defineProperty(exports2, "__esModule", { value: true });
    exports2.DownloadSkillRespSchema = exports2.DownloadSkillToSandboxRespSchema = exports2.GetSkillFileRespSchema = exports2.ListSkillsOutputSchema = exports2.SkillCatalogItemSchema = exports2.SkillSchema = exports2.FileInfoSchema = void 0;
    var zod_1 = require_zod();
    var common_1 = require_common();
    exports2.FileInfoSchema = zod_1.z.object({
      path: zod_1.z.string(),
      mime: zod_1.z.string()
    });
    exports2.SkillSchema = zod_1.z.object({
      id: zod_1.z.string(),
      user_id: zod_1.z.string().nullable().optional(),
      name: zod_1.z.string(),
      description: zod_1.z.string(),
      disk_id: zod_1.z.string(),
      file_index: zod_1.z.array(exports2.FileInfoSchema),
      meta: zod_1.z.record(zod_1.z.string(), zod_1.z.unknown()).nullable(),
      created_at: zod_1.z.string(),
      updated_at: zod_1.z.string()
    });
    exports2.SkillCatalogItemSchema = zod_1.z.object({
      name: zod_1.z.string(),
      description: zod_1.z.string()
    });
    exports2.ListSkillsOutputSchema = zod_1.z.object({
      items: zod_1.z.array(exports2.SkillCatalogItemSchema),
      next_cursor: zod_1.z.string().nullable().optional(),
      has_more: zod_1.z.boolean()
    });
    exports2.GetSkillFileRespSchema = zod_1.z.object({
      path: zod_1.z.string(),
      mime: zod_1.z.string(),
      url: zod_1.z.string().nullable().optional(),
      content: common_1.FileContentSchema.nullable().optional()
    });
    exports2.DownloadSkillToSandboxRespSchema = zod_1.z.object({
      success: zod_1.z.boolean(),
      dir_path: zod_1.z.string(),
      name: zod_1.z.string(),
      description: zod_1.z.string()
    });
    exports2.DownloadSkillRespSchema = zod_1.z.object({
      name: zod_1.z.string(),
      description: zod_1.z.string(),
      dirPath: zod_1.z.string(),
      files: zod_1.z.array(zod_1.z.string())
    });
  }
});

// node_modules/@acontext/acontext/dist/types/sandbox.js
var require_sandbox = __commonJS({
  "node_modules/@acontext/acontext/dist/types/sandbox.js"(exports2) {
    "use strict";
    Object.defineProperty(exports2, "__esModule", { value: true });
    exports2.GetSandboxLogsOutputSchema = exports2.SandboxLogSchema = exports2.GeneratedFileSchema = exports2.HistoryCommandSchema = exports2.SandboxCommandOutputSchema = exports2.SandboxRuntimeInfoSchema = void 0;
    var zod_1 = require_zod();
    exports2.SandboxRuntimeInfoSchema = zod_1.z.object({
      sandbox_id: zod_1.z.string(),
      sandbox_status: zod_1.z.string(),
      sandbox_created_at: zod_1.z.string(),
      sandbox_expires_at: zod_1.z.string()
    });
    exports2.SandboxCommandOutputSchema = zod_1.z.object({
      stdout: zod_1.z.string(),
      stderr: zod_1.z.string(),
      exit_code: zod_1.z.number()
    });
    exports2.HistoryCommandSchema = zod_1.z.object({
      command: zod_1.z.string(),
      exit_code: zod_1.z.number()
    });
    exports2.GeneratedFileSchema = zod_1.z.object({
      sandbox_path: zod_1.z.string()
    });
    exports2.SandboxLogSchema = zod_1.z.object({
      id: zod_1.z.string(),
      project_id: zod_1.z.string(),
      backend_sandbox_id: zod_1.z.string().nullable().optional(),
      backend_type: zod_1.z.string(),
      history_commands: zod_1.z.array(exports2.HistoryCommandSchema),
      generated_files: zod_1.z.array(exports2.GeneratedFileSchema),
      will_total_alive_seconds: zod_1.z.number(),
      created_at: zod_1.z.string(),
      updated_at: zod_1.z.string()
    });
    exports2.GetSandboxLogsOutputSchema = zod_1.z.object({
      items: zod_1.z.array(exports2.SandboxLogSchema),
      next_cursor: zod_1.z.string().nullable().optional(),
      has_more: zod_1.z.boolean()
    });
  }
});

// node_modules/@acontext/acontext/dist/types/user.js
var require_user = __commonJS({
  "node_modules/@acontext/acontext/dist/types/user.js"(exports2) {
    "use strict";
    Object.defineProperty(exports2, "__esModule", { value: true });
    exports2.GetUserResourcesOutputSchema = exports2.UserResourceCountsSchema = exports2.ListUsersOutputSchema = exports2.UserSchema = void 0;
    var zod_1 = require_zod();
    exports2.UserSchema = zod_1.z.object({
      id: zod_1.z.string(),
      project_id: zod_1.z.string(),
      identifier: zod_1.z.string(),
      created_at: zod_1.z.string(),
      updated_at: zod_1.z.string()
    });
    exports2.ListUsersOutputSchema = zod_1.z.object({
      items: zod_1.z.array(exports2.UserSchema),
      next_cursor: zod_1.z.string().nullable().optional(),
      has_more: zod_1.z.boolean()
    });
    exports2.UserResourceCountsSchema = zod_1.z.object({
      sessions_count: zod_1.z.number(),
      disks_count: zod_1.z.number(),
      skills_count: zod_1.z.number()
    });
    exports2.GetUserResourcesOutputSchema = zod_1.z.object({
      counts: exports2.UserResourceCountsSchema
    });
  }
});

// node_modules/@acontext/acontext/dist/types/learning-space.js
var require_learning_space = __commonJS({
  "node_modules/@acontext/acontext/dist/types/learning-space.js"(exports2) {
    "use strict";
    Object.defineProperty(exports2, "__esModule", { value: true });
    exports2.ListLearningSpacesOutputSchema = exports2.LearningSpaceSessionSchema = exports2.LearningSpaceSkillSchema = exports2.LearningSpaceSchema = void 0;
    var zod_1 = require_zod();
    exports2.LearningSpaceSchema = zod_1.z.object({
      id: zod_1.z.string(),
      user_id: zod_1.z.string().nullable().optional(),
      meta: zod_1.z.record(zod_1.z.string(), zod_1.z.unknown()).nullable().optional(),
      created_at: zod_1.z.string(),
      updated_at: zod_1.z.string()
    });
    exports2.LearningSpaceSkillSchema = zod_1.z.object({
      id: zod_1.z.string(),
      learning_space_id: zod_1.z.string(),
      skill_id: zod_1.z.string(),
      created_at: zod_1.z.string()
    });
    exports2.LearningSpaceSessionSchema = zod_1.z.object({
      id: zod_1.z.string(),
      learning_space_id: zod_1.z.string(),
      session_id: zod_1.z.string(),
      status: zod_1.z.string(),
      created_at: zod_1.z.string(),
      updated_at: zod_1.z.string()
    });
    exports2.ListLearningSpacesOutputSchema = zod_1.z.object({
      items: zod_1.z.array(exports2.LearningSpaceSchema),
      next_cursor: zod_1.z.string().nullable().optional(),
      has_more: zod_1.z.boolean()
    });
  }
});

// node_modules/@acontext/acontext/dist/types/project.js
var require_project = __commonJS({
  "node_modules/@acontext/acontext/dist/types/project.js"(exports2) {
    "use strict";
    Object.defineProperty(exports2, "__esModule", { value: true });
  }
});

// node_modules/@acontext/acontext/dist/types/index.js
var require_types = __commonJS({
  "node_modules/@acontext/acontext/dist/types/index.js"(exports2) {
    "use strict";
    var __createBinding = exports2 && exports2.__createBinding || (Object.create ? (function(o, m, k, k2) {
      if (k2 === void 0) k2 = k;
      var desc = Object.getOwnPropertyDescriptor(m, k);
      if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
        desc = { enumerable: true, get: /* @__PURE__ */ __name(function() {
          return m[k];
        }, "get") };
      }
      Object.defineProperty(o, k2, desc);
    }) : (function(o, m, k, k2) {
      if (k2 === void 0) k2 = k;
      o[k2] = m[k];
    }));
    var __exportStar = exports2 && exports2.__exportStar || function(m, exports3) {
      for (var p in m) if (p !== "default" && !Object.prototype.hasOwnProperty.call(exports3, p)) __createBinding(exports3, m, p);
    };
    Object.defineProperty(exports2, "__esModule", { value: true });
    __exportStar(require_common(), exports2);
    __exportStar(require_session(), exports2);
    __exportStar(require_disk(), exports2);
    __exportStar(require_skill(), exports2);
    __exportStar(require_sandbox(), exports2);
    __exportStar(require_user(), exports2);
    __exportStar(require_learning_space(), exports2);
    __exportStar(require_project(), exports2);
  }
});

// node_modules/@acontext/acontext/dist/resources/disks.js
var require_disks = __commonJS({
  "node_modules/@acontext/acontext/dist/resources/disks.js"(exports2) {
    "use strict";
    Object.defineProperty(exports2, "__esModule", { value: true });
    exports2.DiskArtifactsAPI = exports2.DisksAPI = void 0;
    var uploads_1 = require_uploads();
    var utils_1 = require_utils();
    var types_1 = require_types();
    var DisksAPI = class {
      static {
        __name(this, "DisksAPI");
      }
      constructor(requester) {
        this.requester = requester;
        this.artifacts = new DiskArtifactsAPI(requester);
      }
      async list(options) {
        const params = (0, utils_1.buildParams)({
          user: options?.user ?? null,
          limit: options?.limit ?? null,
          cursor: options?.cursor ?? null,
          time_desc: options?.timeDesc ?? null
        });
        const data = await this.requester.request("GET", "/disk", {
          params: Object.keys(params).length > 0 ? params : void 0
        });
        return types_1.ListDisksOutputSchema.parse(data);
      }
      async create(options) {
        const payload = {};
        if (options?.user !== void 0 && options?.user !== null) {
          payload.user = options.user;
        }
        const data = await this.requester.request("POST", "/disk", {
          jsonData: Object.keys(payload).length > 0 ? payload : void 0
        });
        return types_1.DiskSchema.parse(data);
      }
      async delete(diskId) {
        await this.requester.request("DELETE", `/disk/${diskId}`);
      }
    };
    exports2.DisksAPI = DisksAPI;
    var DiskArtifactsAPI = class {
      static {
        __name(this, "DiskArtifactsAPI");
      }
      constructor(requester) {
        this.requester = requester;
      }
      async upsert(diskId, options) {
        const upload = (0, uploads_1.normalizeFileUpload)(options.file);
        const files = {
          file: upload.asFormData()
        };
        const form = {};
        if (options.filePath) {
          form.file_path = options.filePath;
        }
        if (options.meta !== void 0 && options.meta !== null) {
          form.meta = JSON.stringify(options.meta);
        }
        const data = await this.requester.request("POST", `/disk/${diskId}/artifact`, {
          data: Object.keys(form).length > 0 ? form : void 0,
          files
        });
        return types_1.ArtifactSchema.parse(data);
      }
      async get(diskId, options) {
        const fullPath = `${options.filePath.replace(/\/$/, "")}/${options.filename}`;
        const params = (0, utils_1.buildParams)({
          file_path: fullPath,
          with_public_url: options.withPublicUrl ?? null,
          with_content: options.withContent ?? null,
          expire: options.expire ?? null
        });
        const data = await this.requester.request("GET", `/disk/${diskId}/artifact`, {
          params
        });
        return types_1.GetArtifactRespSchema.parse(data);
      }
      async update(diskId, options) {
        const fullPath = `${options.filePath.replace(/\/$/, "")}/${options.filename}`;
        const payload = {
          file_path: fullPath,
          meta: JSON.stringify(options.meta)
        };
        const data = await this.requester.request("PUT", `/disk/${diskId}/artifact`, {
          jsonData: payload
        });
        return types_1.UpdateArtifactRespSchema.parse(data);
      }
      async delete(diskId, options) {
        const fullPath = `${options.filePath.replace(/\/$/, "")}/${options.filename}`;
        const params = { file_path: fullPath };
        await this.requester.request("DELETE", `/disk/${diskId}/artifact`, {
          params
        });
      }
      async list(diskId, options) {
        const params = {};
        if (options?.path !== void 0 && options?.path !== null) {
          params.path = options.path;
        }
        const data = await this.requester.request("GET", `/disk/${diskId}/artifact/ls`, {
          params: Object.keys(params).length > 0 ? params : void 0
        });
        return types_1.ListArtifactsRespSchema.parse(data);
      }
      async grepArtifacts(diskId, options) {
        const params = (0, utils_1.buildParams)({
          query: options.query,
          limit: options.limit ?? 100
        });
        const data = await this.requester.request("GET", `/disk/${diskId}/artifact/grep`, {
          params
        });
        return types_1.ArtifactsSchema.parse(data);
      }
      async globArtifacts(diskId, options) {
        const params = (0, utils_1.buildParams)({
          query: options.query,
          limit: options.limit ?? 100
        });
        const data = await this.requester.request("GET", `/disk/${diskId}/artifact/glob`, {
          params
        });
        return types_1.ArtifactsSchema.parse(data);
      }
      async downloadToSandbox(diskId, options) {
        const payload = {
          file_path: options.filePath,
          filename: options.filename,
          sandbox_id: options.sandboxId,
          sandbox_path: options.sandboxPath
        };
        const data = await this.requester.request("POST", `/disk/${diskId}/artifact/download_to_sandbox`, {
          jsonData: payload
        });
        return Boolean(data?.success);
      }
      async uploadFromSandbox(diskId, options) {
        const payload = {
          sandbox_id: options.sandboxId,
          sandbox_path: options.sandboxPath,
          sandbox_filename: options.sandboxFilename,
          file_path: options.filePath
        };
        const data = await this.requester.request("POST", `/disk/${diskId}/artifact/upload_from_sandbox`, {
          jsonData: payload
        });
        return types_1.ArtifactSchema.parse(data);
      }
    };
    exports2.DiskArtifactsAPI = DiskArtifactsAPI;
  }
});

// node_modules/@acontext/acontext/dist/resources/learning-spaces.js
var require_learning_spaces = __commonJS({
  "node_modules/@acontext/acontext/dist/resources/learning-spaces.js"(exports2) {
    "use strict";
    Object.defineProperty(exports2, "__esModule", { value: true });
    exports2.LearningSpacesAPI = void 0;
    var errors_1 = require_errors();
    var utils_1 = require_utils();
    var types_1 = require_types();
    var LearningSpacesAPI = class {
      static {
        __name(this, "LearningSpacesAPI");
      }
      constructor(requester) {
        this.requester = requester;
      }
      /**
       * Create a new learning space.
       */
      async create(options) {
        const payload = {};
        if (options?.user !== void 0 && options.user !== null) {
          payload.user = options.user;
        }
        if (options?.meta !== void 0 && options.meta !== null) {
          payload.meta = options.meta;
        }
        const data = await this.requester.request("POST", "/learning_spaces", {
          jsonData: payload
        });
        return types_1.LearningSpaceSchema.parse(data);
      }
      /**
       * List learning spaces with optional filters and pagination.
       */
      async list(options) {
        const effectiveLimit = options?.limit ?? 20;
        const params = (0, utils_1.buildParams)({
          user: options?.user ?? null,
          limit: effectiveLimit,
          cursor: options?.cursor ?? null,
          time_desc: options?.timeDesc ?? null
        });
        if (options?.filterByMeta && Object.keys(options.filterByMeta).length > 0) {
          params.filter_by_meta = JSON.stringify(options.filterByMeta);
        }
        const data = await this.requester.request("GET", "/learning_spaces", {
          params: Object.keys(params).length > 0 ? params : void 0
        });
        return types_1.ListLearningSpacesOutputSchema.parse(data);
      }
      /**
       * Get a learning space by ID.
       */
      async get(spaceId) {
        const data = await this.requester.request("GET", `/learning_spaces/${spaceId}`);
        return types_1.LearningSpaceSchema.parse(data);
      }
      /**
       * Update a learning space by merging meta into existing meta.
       */
      async update(spaceId, options) {
        const data = await this.requester.request("PATCH", `/learning_spaces/${spaceId}`, {
          jsonData: { meta: options.meta }
        });
        return types_1.LearningSpaceSchema.parse(data);
      }
      /**
       * Delete a learning space by ID.
       */
      async delete(spaceId) {
        await this.requester.request("DELETE", `/learning_spaces/${spaceId}`);
      }
      /**
       * Create an async learning record from a session.
       */
      async learn(options) {
        const data = await this.requester.request("POST", `/learning_spaces/${options.spaceId}/learn`, { jsonData: { session_id: options.sessionId } });
        return types_1.LearningSpaceSessionSchema.parse(data);
      }
      /**
       * Get a single learning session record by session ID.
       */
      async getSession(options) {
        const data = await this.requester.request("GET", `/learning_spaces/${options.spaceId}/sessions/${options.sessionId}`);
        return types_1.LearningSpaceSessionSchema.parse(data);
      }
      /**
       * Poll until a learning session reaches a terminal status.
       */
      async waitForLearning(options) {
        const timeout = options.timeout ?? 120;
        const pollInterval = options.pollInterval ?? 1;
        const terminal = /* @__PURE__ */ new Set(["completed", "failed"]);
        const deadline = Date.now() + timeout * 1e3;
        while (true) {
          const session = await this.getSession({
            spaceId: options.spaceId,
            sessionId: options.sessionId
          });
          if (terminal.has(session.status)) {
            return session;
          }
          if (Date.now() >= deadline) {
            throw new errors_1.TimeoutError(`learning session ${options.sessionId} did not complete within ${timeout}s (last status: ${session.status})`);
          }
          await new Promise((resolve2) => setTimeout(resolve2, pollInterval * 1e3));
        }
      }
      /**
       * List all learning session records for a space.
       */
      async listSessions(spaceId) {
        const data = await this.requester.request("GET", `/learning_spaces/${spaceId}/sessions`);
        return data.map((item) => types_1.LearningSpaceSessionSchema.parse(item));
      }
      /**
       * Include a skill in a learning space.
       */
      async includeSkill(options) {
        const data = await this.requester.request("POST", `/learning_spaces/${options.spaceId}/skills`, { jsonData: { skill_id: options.skillId } });
        return types_1.LearningSpaceSkillSchema.parse(data);
      }
      /**
       * List all skills in a learning space. Returns full skill data.
       */
      async listSkills(spaceId) {
        const data = await this.requester.request("GET", `/learning_spaces/${spaceId}/skills`);
        return data.map((item) => types_1.SkillSchema.parse(item));
      }
      /**
       * Remove a skill from a learning space. Idempotent.
       */
      async excludeSkill(options) {
        await this.requester.request("DELETE", `/learning_spaces/${options.spaceId}/skills/${options.skillId}`);
      }
    };
    exports2.LearningSpacesAPI = LearningSpacesAPI;
  }
});

// node_modules/@acontext/acontext/dist/resources/project.js
var require_project2 = __commonJS({
  "node_modules/@acontext/acontext/dist/resources/project.js"(exports2) {
    "use strict";
    Object.defineProperty(exports2, "__esModule", { value: true });
    exports2.ProjectAPI = void 0;
    var ProjectAPI = class {
      static {
        __name(this, "ProjectAPI");
      }
      constructor(requester) {
        this.requester = requester;
      }
      /**
       * Get the project-level configuration.
       *
       * @returns ProjectConfig containing the current project configuration
       */
      async getConfigs() {
        const data = await this.requester.request("GET", "/project/configs");
        return data;
      }
      /**
       * Update the project-level configuration by merging keys.
       * Keys with null values are deleted (reset to default).
       *
       * @param configs - Configuration keys to merge
       * @returns ProjectConfig containing the updated project configuration
       */
      async updateConfigs(configs) {
        const data = await this.requester.request("PATCH", "/project/configs", {
          jsonData: configs
        });
        return data;
      }
    };
    exports2.ProjectAPI = ProjectAPI;
  }
});

// node_modules/@acontext/acontext/dist/resources/sandboxes.js
var require_sandboxes = __commonJS({
  "node_modules/@acontext/acontext/dist/resources/sandboxes.js"(exports2) {
    "use strict";
    Object.defineProperty(exports2, "__esModule", { value: true });
    exports2.SandboxesAPI = void 0;
    var utils_1 = require_utils();
    var types_1 = require_types();
    var SandboxesAPI = class {
      static {
        __name(this, "SandboxesAPI");
      }
      constructor(requester) {
        this.requester = requester;
      }
      /**
       * Create and start a new sandbox.
       *
       * @returns SandboxRuntimeInfo containing the sandbox ID, status, and timestamps
       */
      async create() {
        const data = await this.requester.request("POST", "/sandbox");
        return types_1.SandboxRuntimeInfoSchema.parse(data);
      }
      /**
       * Execute a shell command in the sandbox.
       *
       * @param options - Command execution options
       * @param options.sandboxId - The UUID of the sandbox
       * @param options.command - The shell command to execute
       * @param options.timeout - Optional timeout in milliseconds for this command.
       *                          If not provided, uses the client's default timeout.
       * @returns SandboxCommandOutput containing stdout, stderr, and exit code
       */
      async execCommand(options) {
        const data = await this.requester.request("POST", `/sandbox/${options.sandboxId}/exec`, {
          jsonData: { command: options.command },
          timeout: options.timeout
        });
        return types_1.SandboxCommandOutputSchema.parse(data);
      }
      /**
       * Kill a running sandbox.
       *
       * @param sandboxId - The UUID of the sandbox to kill
       * @returns FlagResponse with status and error message
       */
      async kill(sandboxId) {
        const data = await this.requester.request("DELETE", `/sandbox/${sandboxId}`);
        return types_1.FlagResponseSchema.parse(data);
      }
      /**
       * Get sandbox logs for the project with cursor-based pagination.
       *
       * @param options - Optional parameters for retrieving logs
       * @param options.limit - Maximum number of logs to return (default 20, max 200)
       * @param options.cursor - Cursor for pagination. Use the cursor from the previous response to get the next page
       * @param options.timeDesc - Order by created_at descending if true, ascending if false (default false)
       * @returns GetSandboxLogsOutput containing the list of sandbox logs and pagination information
       */
      async getLogs(options) {
        const params = (0, utils_1.buildParams)({
          limit: options?.limit ?? null,
          cursor: options?.cursor ?? null,
          time_desc: options?.timeDesc ?? null
        });
        const data = await this.requester.request("GET", "/sandbox/logs", {
          params: Object.keys(params).length > 0 ? params : void 0
        });
        return types_1.GetSandboxLogsOutputSchema.parse(data);
      }
    };
    exports2.SandboxesAPI = SandboxesAPI;
  }
});

// node_modules/@acontext/acontext/dist/messages.js
var require_messages = __commonJS({
  "node_modules/@acontext/acontext/dist/messages.js"(exports2) {
    "use strict";
    Object.defineProperty(exports2, "__esModule", { value: true });
    exports2.AcontextMessage = exports2.AcontextMessageSchema = exports2.MessagePart = exports2.MessagePartSchema = void 0;
    exports2.buildAcontextMessage = buildAcontextMessage;
    var zod_1 = require_zod();
    exports2.MessagePartSchema = zod_1.z.object({
      type: zod_1.z.string(),
      text: zod_1.z.string().nullable().optional(),
      meta: zod_1.z.record(zod_1.z.string(), zod_1.z.unknown()).nullable().optional(),
      file_field: zod_1.z.string().nullable().optional()
    });
    var MessagePart = class _MessagePart {
      static {
        __name(this, "MessagePart");
      }
      constructor(data) {
        this.type = data.type;
        this.text = data.text ?? null;
        this.meta = data.meta ?? null;
        this.file_field = data.file_field ?? null;
      }
      static textPart(text, options) {
        return new _MessagePart({
          type: "text",
          text,
          meta: options?.meta ?? null
        });
      }
      static fileFieldPart(fileField, options) {
        return new _MessagePart({
          type: "file",
          file_field: fileField,
          meta: options?.meta ?? null
        });
      }
      toJSON() {
        return {
          type: this.type,
          text: this.text ?? null,
          meta: this.meta ?? null,
          file_field: this.file_field ?? null
        };
      }
    };
    exports2.MessagePart = MessagePart;
    exports2.AcontextMessageSchema = zod_1.z.object({
      role: zod_1.z.enum(["user", "assistant"]),
      parts: zod_1.z.array(exports2.MessagePartSchema),
      meta: zod_1.z.record(zod_1.z.string(), zod_1.z.unknown()).nullable().optional()
    });
    var AcontextMessage = class {
      static {
        __name(this, "AcontextMessage");
      }
      constructor(data) {
        this.role = data.role;
        this.parts = data.parts.map((p) => p instanceof MessagePart ? p : new MessagePart(p));
        this.meta = data.meta ?? null;
      }
      toJSON() {
        return {
          role: this.role,
          parts: this.parts.map((p) => p.toJSON()),
          meta: this.meta ?? null
        };
      }
    };
    exports2.AcontextMessage = AcontextMessage;
    function buildAcontextMessage(options) {
      if (!["user", "assistant"].includes(options.role)) {
        throw new Error("role must be one of {'user', 'assistant'}");
      }
      const normalizedParts = options.parts.map((part) => {
        if (part instanceof MessagePart) {
          return part;
        }
        if (typeof part === "string") {
          return MessagePart.textPart(part);
        }
        if (typeof part === "object" && part !== null) {
          if (!("type" in part)) {
            throw new Error("mapping message parts must include a 'type'");
          }
          return new MessagePart(part);
        }
        throw new TypeError("unsupported message part type");
      });
      return new AcontextMessage({
        role: options.role,
        parts: normalizedParts,
        meta: options.meta ?? null
      });
    }
    __name(buildAcontextMessage, "buildAcontextMessage");
  }
});

// node_modules/@acontext/acontext/dist/resources/sessions.js
var require_sessions = __commonJS({
  "node_modules/@acontext/acontext/dist/resources/sessions.js"(exports2) {
    "use strict";
    Object.defineProperty(exports2, "__esModule", { value: true });
    exports2.SessionsAPI = void 0;
    var messages_1 = require_messages();
    var utils_1 = require_utils();
    var types_1 = require_types();
    var SessionsAPI = class {
      static {
        __name(this, "SessionsAPI");
      }
      constructor(requester) {
        this.requester = requester;
      }
      /**
       * List all sessions in the project.
       *
       * @param options - Options for listing sessions.
       * @param options.user - Filter by user identifier.
       * @param options.limit - Maximum number of sessions to return.
       * @param options.cursor - Cursor for pagination.
       * @param options.timeDesc - Order by created_at descending if true, ascending if false.
       * @param options.filterByConfigs - Filter by session configs using JSONB containment.
       *   Only sessions where configs contains all key-value pairs in this object will be returned.
       *   Supports nested objects. Note: Matching is case-sensitive and type-sensitive.
       *   Sessions with NULL configs are excluded from filtered results.
       * @returns ListSessionsOutput containing the list of sessions and pagination information.
       */
      async list(options) {
        const params = {};
        if (options?.user) {
          params.user = options.user;
        }
        if (options?.filterByConfigs && Object.keys(options.filterByConfigs).length > 0) {
          params.filter_by_configs = JSON.stringify(options.filterByConfigs);
        }
        Object.assign(params, (0, utils_1.buildParams)({
          limit: options?.limit ?? null,
          cursor: options?.cursor ?? null,
          time_desc: options?.timeDesc ?? null
        }));
        const data = await this.requester.request("GET", "/session", {
          params: Object.keys(params).length > 0 ? params : void 0
        });
        return types_1.ListSessionsOutputSchema.parse(data);
      }
      /**
       * Create a new session.
       *
       * @param options - Options for creating a session.
       * @param options.user - Optional user identifier string.
       * @param options.disableTaskTracking - Whether to disable task tracking for this session.
       * @param options.configs - Optional session configuration dictionary.
       * @param options.useUuid - Optional UUID string to use as the session ID. If not provided, a UUID will be auto-generated.
       *   If a session with this UUID already exists, a 409 Conflict error will be raised.
       * @returns The created Session object.
       */
      async create(options) {
        const payload = {};
        if (options?.user !== void 0 && options?.user !== null) {
          payload.user = options.user;
        }
        if (options?.disableTaskTracking !== void 0 && options?.disableTaskTracking !== null) {
          payload.disable_task_tracking = options.disableTaskTracking;
        }
        if (options?.configs !== void 0) {
          payload.configs = options.configs;
        }
        if (options?.useUuid !== void 0 && options?.useUuid !== null) {
          payload.use_uuid = options.useUuid;
        }
        const data = await this.requester.request("POST", "/session", {
          jsonData: Object.keys(payload).length > 0 ? payload : void 0
        });
        return types_1.SessionSchema.parse(data);
      }
      async delete(sessionId) {
        await this.requester.request("DELETE", `/session/${sessionId}`);
      }
      async updateConfigs(sessionId, options) {
        const payload = { configs: options.configs };
        await this.requester.request("PUT", `/session/${sessionId}/configs`, {
          jsonData: payload
        });
      }
      async getConfigs(sessionId) {
        const data = await this.requester.request("GET", `/session/${sessionId}/configs`);
        return types_1.SessionSchema.parse(data);
      }
      async getTasks(sessionId, options) {
        const params = (0, utils_1.buildParams)({
          limit: options?.limit ?? null,
          cursor: options?.cursor ?? null,
          time_desc: options?.timeDesc ?? null
        });
        const data = await this.requester.request("GET", `/session/${sessionId}/task`, {
          params: Object.keys(params).length > 0 ? params : void 0
        });
        return types_1.GetTasksOutputSchema.parse(data);
      }
      /**
       * Get a summary of all tasks in a session as a formatted string.
       *
       * @param sessionId - The UUID of the session.
       * @param options - Options for retrieving the summary.
       * @param options.limit - Maximum number of tasks to include in the summary.
       * @returns A formatted string containing the session summary with all task information.
       */
      async getSessionSummary(sessionId, options) {
        const tasksOutput = await this.getTasks(sessionId, {
          limit: options?.limit,
          timeDesc: false
        });
        const tasks = tasksOutput.items;
        if (tasks.length === 0) {
          return "";
        }
        const parts = [];
        for (const task of tasks) {
          const taskLines = [
            `<task id="${task.order}" description="${task.data.task_description}">`
          ];
          if (task.data.progresses && task.data.progresses.length > 0) {
            taskLines.push("<progress>");
            task.data.progresses.forEach((p, i) => {
              taskLines.push(`${i + 1}. ${p}`);
            });
            taskLines.push("</progress>");
          }
          if (task.data.user_preferences && task.data.user_preferences.length > 0) {
            taskLines.push("<user_preference>");
            task.data.user_preferences.forEach((pref, i) => {
              taskLines.push(`${i + 1}. ${pref}`);
            });
            taskLines.push("</user_preference>");
          }
          taskLines.push("</task>");
          parts.push(taskLines.join("\n"));
        }
        return parts.join("\n");
      }
      /**
       * Store a message to a session.
       *
       * @param sessionId - The UUID of the session.
       * @param blob - The message blob in Acontext, OpenAI, Anthropic, or Gemini format.
       * @param options - Options for storing the message.
       * @param options.format - The format of the message blob ('acontext', 'openai', 'anthropic', or 'gemini').
       * @param options.meta - Optional user-provided metadata for the message. This metadata is stored
       *   separately from the message content and can be retrieved via getMessages().metas
       *   or updated via patchMessageMeta(). Works with all formats.
       * @param options.fileField - The field name for file upload. Only used when format is 'acontext'.
       * @param options.file - Optional file upload. Only used when format is 'acontext'.
       * @returns The created Message object. The msg.meta field contains only user-provided metadata.
       */
      async storeMessage(sessionId, blob, options) {
        const format = options?.format ?? "openai";
        if (!["acontext", "openai", "anthropic", "gemini"].includes(format)) {
          throw new Error("format must be one of {'acontext', 'openai', 'anthropic', 'gemini'}");
        }
        if (options?.file && !options?.fileField) {
          throw new Error("fileField is required when file is provided");
        }
        const payload = {
          format
        };
        if (options?.meta !== void 0 && options?.meta !== null) {
          payload.meta = options.meta;
        }
        if (format === "acontext") {
          if (blob instanceof messages_1.AcontextMessage) {
            payload.blob = blob.toJSON();
          } else {
            const message = new messages_1.AcontextMessage(blob);
            payload.blob = message.toJSON();
          }
        } else {
          payload.blob = blob;
        }
        if (options?.file && options?.fileField) {
          const formData = {
            payload: JSON.stringify(payload)
          };
          const files = {
            [options.fileField]: options.file.asFormData()
          };
          const data = await this.requester.request("POST", `/session/${sessionId}/messages`, {
            data: formData,
            files
          });
          return types_1.MessageSchema.parse(data);
        } else {
          const data = await this.requester.request("POST", `/session/${sessionId}/messages`, {
            jsonData: payload
          });
          return types_1.MessageSchema.parse(data);
        }
      }
      /**
       * Add a structured event to a session.
       *
       * @param sessionId - The UUID of the session.
       * @param event - An event object with a toPayload() method (e.g., DiskEvent, TextEvent).
       * @returns The created SessionEvent object.
       */
      async addEvent(sessionId, event) {
        const payload = event.toPayload();
        const data = await this.requester.request("POST", `/session/${sessionId}/events`, {
          jsonData: payload
        });
        return types_1.SessionEventSchema.parse(data);
      }
      /**
       * Get events for a session.
       *
       * @param sessionId - The UUID of the session.
       * @param options - Options for retrieving events.
       * @returns ListEventsOutput containing the list of events and pagination information.
       */
      async getEvents(sessionId, options) {
        const params = (0, utils_1.buildParams)({
          limit: options?.limit ?? null,
          cursor: options?.cursor ?? null,
          time_desc: options?.timeDesc ?? null
        });
        const data = await this.requester.request("GET", `/session/${sessionId}/events`, {
          params: Object.keys(params).length > 0 ? params : void 0
        });
        return types_1.ListEventsOutputSchema.parse(data);
      }
      /**
       * Get messages for a session.
       *
       * @param sessionId - The UUID of the session.
       * @param options - Options for retrieving messages.
       * @param options.limit - Maximum number of messages to return.
       * @param options.cursor - Cursor for pagination.
       * @param options.withAssetPublicUrl - Whether to include presigned URLs for assets.
       * @param options.withEvents - Whether to include session events in the response.
       * @param options.format - The format of the messages ('acontext', 'openai', 'anthropic', or 'gemini').
       * @param options.timeDesc - Order by created_at descending if true, ascending if false.
       * @param options.editStrategies - Optional list of edit strategies to apply before format conversion.
       *   Examples:
       *   - Remove tool results: [{ type: 'remove_tool_result', params: { keep_recent_n_tool_results: 3 } }]
       *   - Remove large tool results: [{ type: 'remove_tool_result', params: { gt_token: 100 } }]
       *   - Remove large tool call params: [{ type: 'remove_tool_call_params', params: { gt_token: 100 } }]
       *   - Middle out: [{ type: 'middle_out', params: { token_reduce_to: 5000 } }]
       *   - Token limit: [{ type: 'token_limit', params: { limit_tokens: 20000 } }]
       *   Throws if editStrategies fail schema validation.
       * @param options.pinEditingStrategiesAtMessage - Message ID to pin editing strategies at.
       *   When provided, strategies are only applied to messages up to and including this message ID,
       *   keeping subsequent messages unchanged. This helps maintain prompt cache stability by
       *   preserving a stable prefix. The response includes edit_at_message_id indicating where
       *   strategies were applied. Pass this value in subsequent requests to maintain cache hits.
       * @returns GetMessagesOutput containing the list of messages and pagination information.
       */
      async getMessages(sessionId, options) {
        const params = {};
        if (options?.format !== void 0) {
          params.format = options.format;
        }
        Object.assign(params, (0, utils_1.buildParams)({
          limit: options?.limit ?? null,
          cursor: options?.cursor ?? null,
          with_asset_public_url: options?.withAssetPublicUrl ?? null,
          time_desc: options?.timeDesc ?? true
          // Default to true
        }));
        if (options?.withEvents !== void 0 && options?.withEvents !== null) {
          params.with_events = options.withEvents ? "true" : "false";
        }
        if (options?.editStrategies !== void 0 && options?.editStrategies !== null) {
          types_1.EditStrategySchema.array().parse(options.editStrategies);
          params.edit_strategies = JSON.stringify(options.editStrategies);
        }
        if (options?.pinEditingStrategiesAtMessage !== void 0 && options?.pinEditingStrategiesAtMessage !== null) {
          params.pin_editing_strategies_at_message = options.pinEditingStrategiesAtMessage;
        }
        const data = await this.requester.request("GET", `/session/${sessionId}/messages`, {
          params: Object.keys(params).length > 0 ? params : void 0
        });
        return types_1.GetMessagesOutputSchema.parse(data);
      }
      async flush(sessionId) {
        const data = await this.requester.request("POST", `/session/${sessionId}/flush`);
        return data;
      }
      /**
       * Get total token counts for all text and tool-call parts in a session.
       *
       * @param sessionId - The UUID of the session.
       * @returns TokenCounts object containing total_tokens.
       */
      async getTokenCounts(sessionId) {
        const data = await this.requester.request("GET", `/session/${sessionId}/token_counts`);
        return types_1.TokenCountsSchema.parse(data);
      }
      /**
       * Get message observing status counts for a session.
       *
       * Returns the count of messages by their observing status:
       * observed, in_process, and pending.
       *
       * @param sessionId - The UUID of the session.
       * @returns MessageObservingStatus object containing observed, in_process,
       *          pending counts and updated_at timestamp.
       */
      async messagesObservingStatus(sessionId) {
        const data = await this.requester.request("GET", `/session/${sessionId}/observing_status`);
        return types_1.MessageObservingStatusSchema.parse(data);
      }
      /**
       * Update message metadata using patch semantics.
       *
       * Only updates keys present in the meta object. Existing keys not in the request
       * are preserved. To delete a key, pass null as its value.
       *
       * @param sessionId - The UUID of the session.
       * @param messageId - The UUID of the message.
       * @param meta - Object of metadata keys to add, update, or delete. Pass null as a value to delete that key.
       * @returns The complete user metadata after the patch operation.
       *
       * @example
       * // Add/update keys
       * const updated = await client.sessions.patchMessageMeta(
       *   sessionId, messageId,
       *   { status: 'processed', score: 0.95 }
       * );
       *
       * @example
       * // Delete a key
       * const updated = await client.sessions.patchMessageMeta(
       *   sessionId, messageId,
       *   { old_key: null }  // Deletes "old_key"
       * );
       */
      async patchMessageMeta(sessionId, messageId, meta) {
        const payload = { meta };
        const data = await this.requester.request("PATCH", `/session/${sessionId}/messages/${messageId}/meta`, {
          jsonData: payload
        });
        return data.meta ?? {};
      }
      /**
       * Update session configs using patch semantics.
       *
       * Only updates keys present in the configs object. Existing keys not in the request
       * are preserved. To delete a key, pass null as its value.
       *
       * @param sessionId - The UUID of the session.
       * @param configs - Object of config keys to add, update, or delete. Pass null as a value to delete that key.
       * @returns The complete configs after the patch operation.
       *
       * @example
       * // Add/update keys
       * const updated = await client.sessions.patchConfigs(
       *   sessionId,
       *   { agent: 'bot2', temperature: 0.8 }
       * );
       *
       * @example
       * // Delete a key
       * const updated = await client.sessions.patchConfigs(
       *   sessionId,
       *   { old_key: null }  // Deletes "old_key"
       * );
       */
      async patchConfigs(sessionId, configs) {
        const payload = { configs };
        const data = await this.requester.request("PATCH", `/session/${sessionId}/configs`, {
          jsonData: payload
        });
        return data.configs ?? {};
      }
      /**
       * Copy (duplicate) a session with all its messages and tasks.
       *
       * Creates a complete copy of the session including all messages, tasks, and configurations.
       * The copied session will be independent and modifications to it won't affect the original.
       *
       * @param sessionId - The UUID of the session to copy.
       * @returns CopySessionResult containing the original and new session IDs.
       * @throws {Error} If session_id is invalid or session doesn't exist.
       * @throws {Error} If session exceeds maximum copyable size (5000 messages).
       *
       * @example
       * const result = await client.sessions.copy(sessionId);
       * console.log(`Copied session: ${result.newSessionId}`);
       * console.log(`Original session: ${result.oldSessionId}`);
       */
      async copy(sessionId) {
        (0, utils_1.validateUUID)(sessionId, "sessionId");
        const data = await this.requester.request("POST", `/session/${sessionId}/copy`);
        return types_1.CopySessionResultSchema.parse(data);
      }
    };
    exports2.SessionsAPI = SessionsAPI;
  }
});

// node_modules/@acontext/acontext/dist/resources/skills.js
var require_skills = __commonJS({
  "node_modules/@acontext/acontext/dist/resources/skills.js"(exports2) {
    "use strict";
    var __createBinding = exports2 && exports2.__createBinding || (Object.create ? (function(o, m, k, k2) {
      if (k2 === void 0) k2 = k;
      var desc = Object.getOwnPropertyDescriptor(m, k);
      if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
        desc = { enumerable: true, get: /* @__PURE__ */ __name(function() {
          return m[k];
        }, "get") };
      }
      Object.defineProperty(o, k2, desc);
    }) : (function(o, m, k, k2) {
      if (k2 === void 0) k2 = k;
      o[k2] = m[k];
    }));
    var __setModuleDefault = exports2 && exports2.__setModuleDefault || (Object.create ? (function(o, v) {
      Object.defineProperty(o, "default", { enumerable: true, value: v });
    }) : function(o, v) {
      o["default"] = v;
    });
    var __importStar = exports2 && exports2.__importStar || /* @__PURE__ */ (function() {
      var ownKeys = /* @__PURE__ */ __name(function(o) {
        ownKeys = Object.getOwnPropertyNames || function(o2) {
          var ar = [];
          for (var k in o2) if (Object.prototype.hasOwnProperty.call(o2, k)) ar[ar.length] = k;
          return ar;
        };
        return ownKeys(o);
      }, "ownKeys");
      return function(mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) {
          for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        }
        __setModuleDefault(result, mod);
        return result;
      };
    })();
    Object.defineProperty(exports2, "__esModule", { value: true });
    exports2.SkillsAPI = void 0;
    var fs4 = __importStar(require("fs/promises"));
    var path5 = __importStar(require("path"));
    var uploads_1 = require_uploads();
    var utils_1 = require_utils();
    var types_1 = require_types();
    var SkillsAPI = class {
      static {
        __name(this, "SkillsAPI");
      }
      constructor(requester) {
        this.requester = requester;
      }
      async create(options) {
        const upload = (0, uploads_1.normalizeFileUpload)(options.file);
        const files = {
          file: upload.asFormData()
        };
        const form = {};
        if (options.user !== void 0 && options.user !== null) {
          form.user = options.user;
        }
        if (options.meta !== void 0 && options.meta !== null) {
          form.meta = JSON.stringify(options.meta);
        }
        const data = await this.requester.request("POST", "/agent_skills", {
          data: Object.keys(form).length > 0 ? form : void 0,
          files
        });
        return types_1.SkillSchema.parse(data);
      }
      /**
       * Get a catalog of skills (names and descriptions only) with pagination.
       *
       * @param options - Pagination options
       * @param options.user - Filter by user identifier (optional)
       * @param options.limit - Maximum number of skills per page (defaults to 100, max 200)
       * @param options.cursor - Cursor for pagination to fetch the next page (optional)
       * @param options.timeDesc - Order by created_at descending if true, ascending if false (defaults to false)
       * @returns ListSkillsOutput containing skills with name and description for the current page,
       *          along with pagination information (next_cursor and has_more)
       */
      async listCatalog(options) {
        const effectiveLimit = options?.limit ?? 100;
        const params = (0, utils_1.buildParams)({
          user: options?.user ?? null,
          limit: effectiveLimit,
          cursor: options?.cursor ?? null,
          time_desc: options?.timeDesc ?? null
        });
        const data = await this.requester.request("GET", "/agent_skills", {
          params: Object.keys(params).length > 0 ? params : void 0
        });
        return types_1.ListSkillsOutputSchema.parse(data);
      }
      /**
       * Get a skill by its ID.
       *
       * @param skillId - The UUID of the skill
       * @returns Skill containing the full skill information including file_index
       */
      async get(skillId) {
        const data = await this.requester.request("GET", `/agent_skills/${skillId}`);
        return types_1.SkillSchema.parse(data);
      }
      async delete(skillId) {
        await this.requester.request("DELETE", `/agent_skills/${skillId}`);
      }
      /**
       * Get a file from a skill by skill ID.
       *
       * The backend automatically returns content for parseable text files, or a presigned URL
       * for non-parseable files (binary, images, etc.).
       *
       * @param options - File retrieval options
       * @param options.skillId - The UUID of the skill
       * @param options.filePath - Relative path to the file within the skill (e.g., 'scripts/extract_text.json')
       * @param options.expire - URL expiration time in seconds (defaults to 900 / 15 minutes)
       * @returns GetSkillFileResp containing the file path, MIME type, and either content or URL
       */
      async getFile(options) {
        const endpoint = `/agent_skills/${options.skillId}/file`;
        const params = {
          file_path: options.filePath
        };
        if (options.expire !== void 0 && options.expire !== null) {
          params.expire = options.expire;
        }
        const data = await this.requester.request("GET", endpoint, {
          params
        });
        return types_1.GetSkillFileRespSchema.parse(data);
      }
      /**
       * Download all files from a skill to a local directory.
       *
       * Recursively downloads every file in the skill's file_index,
       * preserving the directory structure.
       *
       * @param skillId - The UUID of the skill
       * @param options - Download options
       * @param options.path - Local directory path to download files into
       * @returns DownloadSkillResp with skill name, description, resolved dirPath, and list of downloaded file paths
       */
      async download(skillId, options) {
        const skill = await this.get(skillId);
        const dest = path5.resolve(options.path);
        await fs4.mkdir(dest, { recursive: true });
        const downloaded = [];
        for (const fi of skill.file_index) {
          const resp = await this.getFile({ skillId, filePath: fi.path });
          const fileDest = path5.join(dest, fi.path);
          await fs4.mkdir(path5.dirname(fileDest), { recursive: true });
          if (resp.content) {
            await fs4.writeFile(fileDest, resp.content.raw, "utf-8");
          } else if (resp.url) {
            const r = await fetch(resp.url);
            if (!r.ok) {
              throw new Error(`Failed to download ${fi.path}: ${r.status} ${r.statusText}`);
            }
            const buffer = Buffer.from(await r.arrayBuffer());
            await fs4.writeFile(fileDest, buffer);
          }
          downloaded.push(fi.path);
        }
        return {
          name: skill.name,
          description: skill.description,
          dirPath: dest,
          files: downloaded
        };
      }
      /**
       * Download all files from a skill to a sandbox environment.
       *
       * Files are placed at /skills/{skillName}/.
       *
       * @param skillId - The UUID of the skill to download
       * @param options - Download options
       * @param options.sandboxId - The UUID of the target sandbox
       * @returns DownloadSkillToSandboxResp containing success status, directory path, skill name and description
       */
      async downloadToSandbox(skillId, options) {
        const payload = {
          sandbox_id: options.sandboxId
        };
        const data = await this.requester.request("POST", `/agent_skills/${skillId}/download_to_sandbox`, { jsonData: payload });
        return types_1.DownloadSkillToSandboxRespSchema.parse(data);
      }
    };
    exports2.SkillsAPI = SkillsAPI;
  }
});

// node_modules/@acontext/acontext/dist/resources/users.js
var require_users = __commonJS({
  "node_modules/@acontext/acontext/dist/resources/users.js"(exports2) {
    "use strict";
    Object.defineProperty(exports2, "__esModule", { value: true });
    exports2.UsersAPI = void 0;
    var utils_1 = require_utils();
    var types_1 = require_types();
    var UsersAPI = class {
      static {
        __name(this, "UsersAPI");
      }
      constructor(requester) {
        this.requester = requester;
      }
      /**
       * List all users in the project.
       *
       * @param options - Optional parameters for listing users
       * @param options.limit - Maximum number of users to return. If not provided or 0, all users will be returned.
       * @param options.cursor - Cursor for pagination
       * @param options.timeDesc - Order by created_at descending if true, ascending if false
       * @returns ListUsersOutput containing the list of users and pagination information
       */
      async list(options) {
        const params = (0, utils_1.buildParams)({
          limit: options?.limit ?? null,
          cursor: options?.cursor ?? null,
          time_desc: options?.timeDesc ?? null
        });
        const data = await this.requester.request("GET", "/user/ls", {
          params: Object.keys(params).length > 0 ? params : void 0
        });
        return types_1.ListUsersOutputSchema.parse(data);
      }
      /**
       * Get resource counts for a user.
       *
       * @param identifier - The user identifier string
       * @returns GetUserResourcesOutput containing counts for Sessions, Disks, and Skills
       */
      async getResources(identifier) {
        const data = await this.requester.request("GET", `/user/${encodeURIComponent(identifier)}/resources`);
        return types_1.GetUserResourcesOutputSchema.parse(data);
      }
      /**
       * Delete a user and cascade delete all associated resources (Session, Disk, Skill).
       *
       * @param identifier - The user identifier string
       */
      async delete(identifier) {
        await this.requester.request("DELETE", `/user/${encodeURIComponent(identifier)}`);
      }
    };
    exports2.UsersAPI = UsersAPI;
  }
});

// node_modules/@acontext/acontext/dist/constants.js
var require_constants = __commonJS({
  "node_modules/@acontext/acontext/dist/constants.js"(exports2) {
    "use strict";
    Object.defineProperty(exports2, "__esModule", { value: true });
    exports2.DEFAULT_USER_AGENT = exports2.DEFAULT_BASE_URL = void 0;
    exports2.DEFAULT_BASE_URL = "https://api.acontext.app/api/v1";
    exports2.DEFAULT_USER_AGENT = "acontext-ts/0.0.1";
  }
});

// node_modules/@acontext/acontext/dist/client.js
var require_client = __commonJS({
  "node_modules/@acontext/acontext/dist/client.js"(exports2) {
    "use strict";
    var __createBinding = exports2 && exports2.__createBinding || (Object.create ? (function(o, m, k, k2) {
      if (k2 === void 0) k2 = k;
      var desc = Object.getOwnPropertyDescriptor(m, k);
      if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
        desc = { enumerable: true, get: /* @__PURE__ */ __name(function() {
          return m[k];
        }, "get") };
      }
      Object.defineProperty(o, k2, desc);
    }) : (function(o, m, k, k2) {
      if (k2 === void 0) k2 = k;
      o[k2] = m[k];
    }));
    var __setModuleDefault = exports2 && exports2.__setModuleDefault || (Object.create ? (function(o, v) {
      Object.defineProperty(o, "default", { enumerable: true, value: v });
    }) : function(o, v) {
      o["default"] = v;
    });
    var __importStar = exports2 && exports2.__importStar || /* @__PURE__ */ (function() {
      var ownKeys = /* @__PURE__ */ __name(function(o) {
        ownKeys = Object.getOwnPropertyNames || function(o2) {
          var ar = [];
          for (var k in o2) if (Object.prototype.hasOwnProperty.call(o2, k)) ar[ar.length] = k;
          return ar;
        };
        return ownKeys(o);
      }, "ownKeys");
      return function(mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) {
          for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        }
        __setModuleDefault(result, mod);
        return result;
      };
    })();
    Object.defineProperty(exports2, "__esModule", { value: true });
    exports2.AcontextClient = void 0;
    var errors_1 = require_errors();
    var disks_1 = require_disks();
    var learning_spaces_1 = require_learning_spaces();
    var project_1 = require_project2();
    var sandboxes_1 = require_sandboxes();
    var sessions_1 = require_sessions();
    var skills_1 = require_skills();
    var users_1 = require_users();
    var constants_1 = require_constants();
    var AcontextClient = class {
      static {
        __name(this, "AcontextClient");
      }
      constructor(options = {}) {
        this._apiKey = options.apiKey || typeof process !== "undefined" && process.env?.ACONTEXT_API_KEY || "";
        if (!this._apiKey || !this._apiKey.trim()) {
          throw new Error("apiKey is required. Provide it either as a parameter (apiKey='...') or set the ACONTEXT_API_KEY environment variable.");
        }
        this._baseUrl = options.baseUrl || typeof process !== "undefined" && process.env?.ACONTEXT_BASE_URL || constants_1.DEFAULT_BASE_URL;
        this._baseUrl = this._baseUrl.replace(/\/$/, "");
        this._userAgent = options.userAgent || typeof process !== "undefined" && process.env?.ACONTEXT_USER_AGENT || constants_1.DEFAULT_USER_AGENT;
        this._timeout = options.timeout ?? (typeof process !== "undefined" && process.env?.ACONTEXT_TIMEOUT ? parseFloat(process.env.ACONTEXT_TIMEOUT) : 32e4);
        this.sessions = new sessions_1.SessionsAPI(this);
        this.disks = new disks_1.DisksAPI(this);
        this.artifacts = this.disks.artifacts;
        this.skills = new skills_1.SkillsAPI(this);
        this.users = new users_1.UsersAPI(this);
        this.sandboxes = new sandboxes_1.SandboxesAPI(this);
        this.learningSpaces = new learning_spaces_1.LearningSpacesAPI(this);
        this.project = new project_1.ProjectAPI(this);
      }
      get baseUrl() {
        return this._baseUrl;
      }
      /**
       * Ping the API server to check connectivity.
       *
       * @returns Promise resolving to "pong" if the server is reachable and responding.
       * @throws {APIError} If the server returns an error response.
       * @throws {TransportError} If there's a network connectivity issue.
       */
      async ping() {
        const response = await this.request("GET", "/ping", {
          unwrap: false
        });
        return response.msg || "pong";
      }
      async request(method, path5, options) {
        const unwrap = options?.unwrap !== false;
        const url = `${this._baseUrl}${path5}`;
        const effectiveTimeout = options?.timeout ?? this._timeout;
        try {
          const headers = {
            Authorization: `Bearer ${this._apiKey}`,
            Accept: "application/json",
            "User-Agent": this._userAgent
          };
          let body;
          let requestHeaders = headers;
          if (options?.files) {
            const FormDataClass = await this.getFormData();
            const formData = new FormDataClass();
            if (options.data) {
              for (const [key, value] of Object.entries(options.data)) {
                formData.append(key, value);
              }
            }
            for (const [key, file] of Object.entries(options.files)) {
              if (file.content instanceof Buffer) {
                if (typeof Blob !== "undefined") {
                  const uint8Array = new Uint8Array(file.content);
                  const blob = new Blob([uint8Array], { type: file.contentType });
                  formData.append(key, blob, file.filename);
                } else {
                  formData.append(key, file.content, {
                    filename: file.filename,
                    contentType: file.contentType
                  });
                }
              } else {
                formData.append(key, file.content, {
                  filename: file.filename,
                  contentType: file.contentType
                });
              }
            }
            body = formData;
            delete requestHeaders["Content-Type"];
          } else if (options?.jsonData) {
            body = JSON.stringify(options.jsonData);
            requestHeaders["Content-Type"] = "application/json";
          } else if (options?.data) {
            const FormDataClass = await this.getFormData();
            const formData = new FormDataClass();
            for (const [key, value] of Object.entries(options.data)) {
              formData.append(key, value);
            }
            body = formData;
            delete requestHeaders["Content-Type"];
          }
          let finalUrl = url;
          if (options?.params && Object.keys(options.params).length > 0) {
            const searchParams = new URLSearchParams();
            for (const [key, value] of Object.entries(options.params)) {
              searchParams.append(key, String(value));
            }
            finalUrl = `${url}?${searchParams.toString()}`;
          }
          const fetchImpl = await this.getFetch();
          const controller = new AbortController();
          const timeoutId = setTimeout(() => controller.abort(), effectiveTimeout);
          try {
            const response = await fetchImpl(finalUrl, {
              method,
              headers: requestHeaders,
              body,
              signal: controller.signal
            });
            clearTimeout(timeoutId);
            return await this.handleResponse(response, unwrap);
          } catch (error) {
            clearTimeout(timeoutId);
            if (error instanceof Error && error.name === "AbortError") {
              throw new errors_1.TransportError(`Request timeout after ${effectiveTimeout}ms`);
            }
            throw error;
          }
        } catch (error) {
          if (error instanceof errors_1.APIError || error instanceof errors_1.TransportError) {
            throw error;
          }
          throw new errors_1.TransportError(error instanceof Error ? error.message : String(error));
        }
      }
      async handleResponse(response, unwrap) {
        const contentType = response.headers.get("content-type") || "";
        let parsed = null;
        if (contentType.includes("application/json")) {
          try {
            parsed = await response.json();
          } catch {
            parsed = null;
          }
        }
        if (response.status >= 400) {
          const payload2 = parsed;
          let message = response.statusText;
          let code;
          let error;
          if (payload2 && typeof payload2 === "object") {
            message = String(payload2.msg || payload2.message || message);
            error = payload2.error;
            const codeVal = payload2.code;
            if (typeof codeVal === "number") {
              code = codeVal;
            }
          }
          throw new errors_1.APIError({
            statusCode: response.status,
            code,
            message,
            error,
            payload: payload2
          });
        }
        if (parsed === null) {
          if (unwrap) {
            return await response.text();
          }
          return {
            code: response.status,
            data: await response.text(),
            msg: response.statusText
          };
        }
        const payload = parsed;
        const appCode = payload.code;
        if (typeof appCode === "number" && appCode >= 400) {
          throw new errors_1.APIError({
            statusCode: response.status,
            code: appCode,
            message: String(payload.msg || response.statusText),
            error: payload.error,
            payload
          });
        }
        return unwrap ? payload.data : payload;
      }
      async getFetch() {
        if (typeof fetch !== "undefined") {
          return fetch;
        }
        try {
          const nodeFetch = await Promise.resolve(`${"node-fetch"}`).then((s) => __importStar(require(s)));
          return nodeFetch.default;
        } catch {
          throw new Error("fetch is not available. Please use Node.js 18+ or install node-fetch");
        }
      }
      async getFormData() {
        if (typeof FormData !== "undefined") {
          return FormData;
        }
        try {
          const FormDataModule = await Promise.resolve(`${"form-data"}`).then((s) => __importStar(require(s)));
          return FormDataModule.default;
        } catch {
          throw new Error("FormData is not available. Please use Node.js 18+ or install form-data");
        }
      }
    };
    exports2.AcontextClient = AcontextClient;
  }
});

// node_modules/@acontext/acontext/dist/events.js
var require_events = __commonJS({
  "node_modules/@acontext/acontext/dist/events.js"(exports2) {
    "use strict";
    Object.defineProperty(exports2, "__esModule", { value: true });
    exports2.TextEvent = exports2.DiskEvent = void 0;
    var DiskEvent = class {
      static {
        __name(this, "DiskEvent");
      }
      constructor(options) {
        this.diskId = options.diskId;
        this.path = options.path;
        this.note = options.note;
      }
      toPayload() {
        const data = {
          disk_id: this.diskId,
          path: this.path
        };
        if (this.note !== void 0) {
          data.note = this.note;
        }
        return { type: "disk_event", data };
      }
    };
    exports2.DiskEvent = DiskEvent;
    var TextEvent = class {
      static {
        __name(this, "TextEvent");
      }
      constructor(options) {
        this.text = options.text;
      }
      toPayload() {
        return { type: "text_event", data: { text: this.text } };
      }
    };
    exports2.TextEvent = TextEvent;
  }
});

// node_modules/@acontext/acontext/dist/resources/index.js
var require_resources = __commonJS({
  "node_modules/@acontext/acontext/dist/resources/index.js"(exports2) {
    "use strict";
    var __createBinding = exports2 && exports2.__createBinding || (Object.create ? (function(o, m, k, k2) {
      if (k2 === void 0) k2 = k;
      var desc = Object.getOwnPropertyDescriptor(m, k);
      if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
        desc = { enumerable: true, get: /* @__PURE__ */ __name(function() {
          return m[k];
        }, "get") };
      }
      Object.defineProperty(o, k2, desc);
    }) : (function(o, m, k, k2) {
      if (k2 === void 0) k2 = k;
      o[k2] = m[k];
    }));
    var __exportStar = exports2 && exports2.__exportStar || function(m, exports3) {
      for (var p in m) if (p !== "default" && !Object.prototype.hasOwnProperty.call(exports3, p)) __createBinding(exports3, m, p);
    };
    Object.defineProperty(exports2, "__esModule", { value: true });
    __exportStar(require_sessions(), exports2);
    __exportStar(require_disks(), exports2);
    __exportStar(require_skills(), exports2);
    __exportStar(require_sandboxes(), exports2);
    __exportStar(require_users(), exports2);
    __exportStar(require_learning_spaces(), exports2);
    __exportStar(require_project2(), exports2);
  }
});

// node_modules/@acontext/acontext/dist/agent/base.js
var require_base = __commonJS({
  "node_modules/@acontext/acontext/dist/agent/base.js"(exports2) {
    "use strict";
    Object.defineProperty(exports2, "__esModule", { value: true });
    exports2.BaseToolPool = exports2.AbstractBaseTool = void 0;
    var AbstractBaseTool = class {
      static {
        __name(this, "AbstractBaseTool");
      }
      toOpenAIToolSchema() {
        return {
          type: "function",
          function: {
            name: this.name,
            description: this.description,
            parameters: {
              type: "object",
              properties: this.arguments,
              required: this.requiredArguments
            }
          }
        };
      }
      toAnthropicToolSchema() {
        return {
          name: this.name,
          description: this.description,
          input_schema: {
            type: "object",
            properties: this.arguments,
            required: this.requiredArguments
          }
        };
      }
      toGeminiToolSchema() {
        return {
          name: this.name,
          description: this.description,
          parameters: {
            type: "object",
            properties: this.arguments,
            required: this.requiredArguments
          }
        };
      }
    };
    exports2.AbstractBaseTool = AbstractBaseTool;
    var BaseToolPool = class {
      static {
        __name(this, "BaseToolPool");
      }
      constructor() {
        this.tools = /* @__PURE__ */ new Map();
      }
      addTool(tool) {
        this.tools.set(tool.name, tool);
      }
      removeTool(toolName) {
        this.tools.delete(toolName);
      }
      extendToolPool(pool) {
        for (const [name, tool] of pool.tools.entries()) {
          this.tools.set(name, tool);
        }
      }
      async executeTool(ctx, toolName, llmArguments) {
        const tool = this.tools.get(toolName);
        if (!tool) {
          throw new Error(`Tool '${toolName}' not found`);
        }
        const result = await tool.execute(ctx, llmArguments);
        return result.trim();
      }
      toolExists(toolName) {
        return this.tools.has(toolName);
      }
      toOpenAIToolSchema() {
        return Array.from(this.tools.values()).map((tool) => tool.toOpenAIToolSchema());
      }
      toAnthropicToolSchema() {
        return Array.from(this.tools.values()).map((tool) => tool.toAnthropicToolSchema());
      }
      toGeminiToolSchema() {
        return Array.from(this.tools.values()).map((tool) => tool.toGeminiToolSchema());
      }
    };
    exports2.BaseToolPool = BaseToolPool;
  }
});

// node_modules/@acontext/acontext/dist/agent/disk.js
var require_disk2 = __commonJS({
  "node_modules/@acontext/acontext/dist/agent/disk.js"(exports2) {
    "use strict";
    Object.defineProperty(exports2, "__esModule", { value: true });
    exports2.DISK_TOOLS = exports2.DiskToolPool = exports2.GlobArtifactsTool = exports2.GrepArtifactsTool = exports2.DownloadFileTool = exports2.ListTool = exports2.ReplaceStringTool = exports2.ReadFileTool = exports2.WriteFileTool = void 0;
    var uploads_1 = require_uploads();
    var base_1 = require_base();
    var DISK_CONTEXT_PROMPT = `<disk>
Consider Disk as the google drive for you and user to store and share files.
You can use tool ends with \`*_disk\` to read, write, edit, and share files with users.
Disk is only a sharable file storage, you can't use it to execute code or run commands.
</disk>
`;
    function normalizePath(path5) {
      if (!path5) {
        return "/";
      }
      let normalized = path5.startsWith("/") ? path5 : `/${path5}`;
      if (!normalized.endsWith("/")) {
        normalized += "/";
      }
      return normalized;
    }
    __name(normalizePath, "normalizePath");
    var WriteFileTool = class extends base_1.AbstractBaseTool {
      static {
        __name(this, "WriteFileTool");
      }
      constructor() {
        super(...arguments);
        this.name = "write_file_disk";
        this.description = "Write text content to a file in the file system. Creates the file if it doesn't exist, overwrites if it does.";
        this.arguments = {
          file_path: {
            type: "string",
            description: "Optional folder path to organize files, e.g. '/notes/' or '/documents/'. Defaults to root '/' if not specified."
          },
          filename: {
            type: "string",
            description: "Filename such as 'report.md' or 'demo.txt'."
          },
          content: {
            type: "string",
            description: "Text content to write to the file."
          }
        };
        this.requiredArguments = ["filename", "content"];
      }
      async execute(ctx, llmArguments) {
        const filename = llmArguments.filename;
        const content = llmArguments.content;
        const filePath = llmArguments.file_path || null;
        if (!filename) {
          throw new Error("filename is required");
        }
        if (!content) {
          throw new Error("content is required");
        }
        const normalizedPath = normalizePath(filePath);
        const payload = new uploads_1.FileUpload({
          filename,
          content: Buffer.from(content, "utf-8"),
          contentType: "text/plain"
        });
        const artifact = await ctx.client.disks.artifacts.upsert(ctx.diskId, {
          file: payload,
          filePath: normalizedPath
        });
        return `File '${artifact.filename}' written successfully to '${artifact.path}'`;
      }
    };
    exports2.WriteFileTool = WriteFileTool;
    var ReadFileTool = class extends base_1.AbstractBaseTool {
      static {
        __name(this, "ReadFileTool");
      }
      constructor() {
        super(...arguments);
        this.name = "read_file_disk";
        this.description = "Read a text file from the file system and return its content.";
        this.arguments = {
          file_path: {
            type: "string",
            description: "Optional directory path where the file is located, e.g. '/notes/'. Defaults to root '/' if not specified."
          },
          filename: {
            type: "string",
            description: "Filename to read."
          },
          line_offset: {
            type: "number",
            description: "The line number to start reading from. Default to 0"
          },
          line_limit: {
            type: "number",
            description: "The maximum number of lines to return. Default to 100"
          }
        };
        this.requiredArguments = ["filename"];
      }
      async execute(ctx, llmArguments) {
        const filename = llmArguments.filename;
        const filePath = llmArguments.file_path || null;
        const lineOffset = llmArguments.line_offset || 0;
        const lineLimit = llmArguments.line_limit || 100;
        if (!filename) {
          throw new Error("filename is required");
        }
        const normalizedPath = normalizePath(filePath);
        const result = await ctx.client.disks.artifacts.get(ctx.diskId, {
          filePath: normalizedPath,
          filename,
          withContent: true
        });
        if (!result.content) {
          throw new Error("Failed to read file: server did not return content.");
        }
        const contentStr = result.content.raw;
        const lines = contentStr.split("\n");
        const lineStart = Math.min(lineOffset, Math.max(0, lines.length - 1));
        const lineEnd = Math.min(lineStart + lineLimit, lines.length);
        const preview = lines.slice(lineStart, lineEnd).join("\n");
        return `[${normalizedPath}${filename} - showing L${lineStart}-${lineEnd} of ${lines.length} lines]
${preview}`;
      }
    };
    exports2.ReadFileTool = ReadFileTool;
    var ReplaceStringTool = class extends base_1.AbstractBaseTool {
      static {
        __name(this, "ReplaceStringTool");
      }
      constructor() {
        super(...arguments);
        this.name = "replace_string_disk";
        this.description = "Replace an old string with a new string in a file. Reads the file, performs the replacement, and writes it back.";
        this.arguments = {
          file_path: {
            type: "string",
            description: "Optional directory path where the file is located, e.g. '/notes/'. Defaults to root '/' if not specified."
          },
          filename: {
            type: "string",
            description: "Filename to modify."
          },
          old_string: {
            type: "string",
            description: "The string to be replaced."
          },
          new_string: {
            type: "string",
            description: "The string to replace the old_string with."
          }
        };
        this.requiredArguments = ["filename", "old_string", "new_string"];
      }
      async execute(ctx, llmArguments) {
        const filename = llmArguments.filename;
        const filePath = llmArguments.file_path || null;
        const oldString = llmArguments.old_string;
        const newString = llmArguments.new_string;
        if (!filename) {
          throw new Error("filename is required");
        }
        if (oldString === null || oldString === void 0) {
          throw new Error("old_string is required");
        }
        if (newString === null || newString === void 0) {
          throw new Error("new_string is required");
        }
        const normalizedPath = normalizePath(filePath);
        const result = await ctx.client.disks.artifacts.get(ctx.diskId, {
          filePath: normalizedPath,
          filename,
          withContent: true
        });
        if (!result.content) {
          throw new Error("Failed to read file: server did not return content.");
        }
        const contentStr = result.content.raw;
        if (!contentStr.includes(oldString)) {
          return `String '${oldString}' not found in file '${filename}'`;
        }
        let replacementCount = 0;
        let searchIndex = 0;
        while (searchIndex < contentStr.length) {
          const index = contentStr.indexOf(oldString, searchIndex);
          if (index === -1) {
            break;
          }
          replacementCount++;
          searchIndex = index + oldString.length;
        }
        const updatedContent = contentStr.replace(oldString, newString);
        const payload = new uploads_1.FileUpload({
          filename,
          content: Buffer.from(updatedContent, "utf-8"),
          contentType: "text/plain"
        });
        await ctx.client.disks.artifacts.upsert(ctx.diskId, {
          file: payload,
          filePath: normalizedPath
        });
        return `Found ${replacementCount} old_string in ${normalizedPath}${filename} and replaced it.`;
      }
    };
    exports2.ReplaceStringTool = ReplaceStringTool;
    var ListTool = class extends base_1.AbstractBaseTool {
      static {
        __name(this, "ListTool");
      }
      constructor() {
        super(...arguments);
        this.name = "list_disk";
        this.description = "List all files and directories in a specified path on the disk.";
        this.arguments = {
          file_path: {
            type: "string",
            description: "Optional directory path to list, e.g. '/todo/' or '/notes/'. Root is '/'"
          }
        };
        this.requiredArguments = ["file_path"];
      }
      async execute(ctx, llmArguments) {
        const filePath = llmArguments.file_path;
        const normalizedPath = normalizePath(filePath);
        const result = await ctx.client.disks.artifacts.list(ctx.diskId, {
          path: normalizedPath
        });
        const artifactsList = result.artifacts.map((artifact) => artifact.filename);
        const fileSect = artifactsList.length > 0 ? artifactsList.join("\n") : "[NO FILE]";
        const dirSect = result.directories.length > 0 ? result.directories.map((d) => d.replace(/\/$/, "") + "/").join("\n") : "[NO DIR]";
        return `[Listing in ${normalizedPath}]
Directories:
${dirSect}
Files:
${fileSect}`;
      }
    };
    exports2.ListTool = ListTool;
    var DownloadFileTool = class extends base_1.AbstractBaseTool {
      static {
        __name(this, "DownloadFileTool");
      }
      constructor() {
        super(...arguments);
        this.name = "download_file_disk";
        this.description = "Get a public URL to download a file. Returns a presigned URL that can be shared or used to access the file.";
        this.arguments = {
          file_path: {
            type: "string",
            description: "Optional directory path where the file is located, e.g. '/notes/'. Defaults to root '/' if not specified."
          },
          filename: {
            type: "string",
            description: "Filename to get the download URL for."
          },
          expire: {
            type: "integer",
            description: "URL expiration time in seconds. Defaults to 3600 (1 hour)."
          }
        };
        this.requiredArguments = ["filename"];
      }
      async execute(ctx, llmArguments) {
        const filename = llmArguments.filename;
        const filePath = llmArguments.file_path || null;
        const expire = llmArguments.expire || 3600;
        if (!filename) {
          throw new Error("filename is required");
        }
        const normalizedPath = normalizePath(filePath);
        const result = await ctx.client.disks.artifacts.get(ctx.diskId, {
          filePath: normalizedPath,
          filename,
          withPublicUrl: true,
          expire
        });
        if (!result.public_url) {
          throw new Error("Failed to get public URL: server did not return a URL.");
        }
        return `Public download URL for '${normalizedPath}${filename}' (expires in ${expire}s):
${result.public_url}`;
      }
    };
    exports2.DownloadFileTool = DownloadFileTool;
    var GrepArtifactsTool = class extends base_1.AbstractBaseTool {
      static {
        __name(this, "GrepArtifactsTool");
      }
      constructor() {
        super(...arguments);
        this.name = "grep_disk";
        this.description = "Search for text patterns within file contents using regex. Only searches text-based files (code, markdown, json, csv, etc.). Use this to find specific code patterns, TODO comments, function definitions, or any text content.";
        this.arguments = {
          query: {
            type: "string",
            description: "Regex pattern to search for (e.g., 'TODO.*', 'function.*calculate', 'import.*pandas')"
          },
          limit: {
            type: "integer",
            description: "Maximum number of results to return (default 100)"
          }
        };
        this.requiredArguments = ["query"];
      }
      async execute(ctx, llmArguments) {
        const query = llmArguments.query;
        const limit = llmArguments.limit || 100;
        if (!query) {
          throw new Error("query is required");
        }
        const results = await ctx.client.disks.artifacts.grepArtifacts(ctx.diskId, {
          query,
          limit
        });
        if (results.length === 0) {
          return `No matches found for pattern '${query}'`;
        }
        const matches = results.map((artifact) => `${artifact.path}${artifact.filename}`);
        return `Found ${matches.length} file(s) matching '${query}':
` + matches.join("\n");
      }
    };
    exports2.GrepArtifactsTool = GrepArtifactsTool;
    var GlobArtifactsTool = class extends base_1.AbstractBaseTool {
      static {
        __name(this, "GlobArtifactsTool");
      }
      constructor() {
        super(...arguments);
        this.name = "glob_disk";
        this.description = "Find files by path pattern using glob syntax. Use * for any characters, ? for single character, ** for recursive directories. Perfect for finding files by extension or location.";
        this.arguments = {
          query: {
            type: "string",
            description: "Glob pattern (e.g., '**/*.py' for all Python files, '*.txt' for text files in root, '/docs/**/*.md' for markdown in docs)"
          },
          limit: {
            type: "integer",
            description: "Maximum number of results to return (default 100)"
          }
        };
        this.requiredArguments = ["query"];
      }
      async execute(ctx, llmArguments) {
        const query = llmArguments.query;
        const limit = llmArguments.limit || 100;
        if (!query) {
          throw new Error("query is required");
        }
        const results = await ctx.client.disks.artifacts.globArtifacts(ctx.diskId, {
          query,
          limit
        });
        if (results.length === 0) {
          return `No files found matching pattern '${query}'`;
        }
        const matches = results.map((artifact) => `${artifact.path}${artifact.filename}`);
        return `Found ${matches.length} file(s) matching '${query}':
` + matches.join("\n");
      }
    };
    exports2.GlobArtifactsTool = GlobArtifactsTool;
    var DiskToolPool = class extends base_1.BaseToolPool {
      static {
        __name(this, "DiskToolPool");
      }
      formatContext(client, diskId) {
        return {
          client,
          diskId,
          getContextPrompt() {
            return DISK_CONTEXT_PROMPT;
          }
        };
      }
    };
    exports2.DiskToolPool = DiskToolPool;
    exports2.DISK_TOOLS = new DiskToolPool();
    exports2.DISK_TOOLS.addTool(new WriteFileTool());
    exports2.DISK_TOOLS.addTool(new ReadFileTool());
    exports2.DISK_TOOLS.addTool(new ReplaceStringTool());
    exports2.DISK_TOOLS.addTool(new ListTool());
    exports2.DISK_TOOLS.addTool(new GrepArtifactsTool());
    exports2.DISK_TOOLS.addTool(new GlobArtifactsTool());
    exports2.DISK_TOOLS.addTool(new DownloadFileTool());
  }
});

// node_modules/@acontext/acontext/dist/agent/prompts.js
var require_prompts = __commonJS({
  "node_modules/@acontext/acontext/dist/agent/prompts.js"(exports2) {
    "use strict";
    Object.defineProperty(exports2, "__esModule", { value: true });
    exports2.SANDBOX_BASH_REMINDER = exports2.SANDBOX_TEXT_EDITOR_REMINDER = exports2.SKILL_REMINDER = void 0;
    exports2.SKILL_REMINDER = `MANDATORY SKILL READING AND EXECUTION PROTOCOL:
BEFORE writing ANY code or using ANY execution tools, You MUST complete ALL of
these steps:

STEP 1 - IDENTIFY ALL RELEVANT SKILLS:
- Scan the user message for ALL trigger words from ALL skills
- Identify EVERY skill that matches ANY trigger word
- If multiple skills match, ALL must be processed
- If no skills match, you can skip the following steps

STEP 2 - READ ALL SKILL FILES:
- Use the text_editor_sandbox tool to view EACH identified skill's SKILL.md file
- READ COMPLETELY - do not skim or skip sections
- This step is MANDATORY even if multiple skills are involved
- DO NOT proceed until ALL relevant skill files have been read

STEP 3 - EXECUTE ALL SKILL INSTRUCTIONS:
- Follow the EXACT instructions from EACH skill file read
- If a skill file says to execute file X, then EXECUTE file X
- If a skill file provides code patterns, USE those patterns
- Apply instructions from ALL skills, not just the first one
- NEVER write generic code when skill-specific code exists

CRITICAL RULES:
- Reading the skill file is NOT sufficient - you must FOLLOW its instructions
- Multiple skills = multiple skill files to read AND follow
- Each skill's instructions must be executed, not just acknowledged
- NEVER skip a skill because you already read another skill
- The skills contain specialized, tested code that MUST be used

DO NOT SKIP ANY SKILL FILES OR THEIR INSTRUCTIONS. This protocol applies to EVERY
skill that matches the user's request, without exception.`;
    exports2.SANDBOX_TEXT_EDITOR_REMINDER = `The text_editor_sandbox tool enables viewing, creating, and modifying text files within
the secure sandboxed container environment.

How it works:
- All file operations occur within the sandboxed container filesystem

Command guidelines:
- Always use view before editing to understand file structure
- For str_replace commands, ensure search strings are unique and exact
- Include sufficient context in str_replace for accurate placement
- Use proper escaping for special characters in search/replace strings`;
    exports2.SANDBOX_BASH_REMINDER = `When to use the bash_execution_sandbox tool directly:
- File system operations requiring shell commands (moving, copying, renaming, organizing files)
- Text processing and manipulation using standard Unix tools (grep, sed, awk, cut, sort, etc.) that
should not be done by the text editor tool
- Batch processing of multiple files using shell loops and wildcards
- System inspection tasks (checking file sizes, permissions, directory structures)
- Combining multiple command-line tools in pipelines for complex data processing
- Archive operations (tar, unzip) and file compression/decompression
- Converting between file formats using command-line utilities

When you should write Python file and use bash tool to run it:
- Complex data analysis or numerical computation (use file operations to write a Python script instead, and
then the bash to run the script)
- Tasks requiring advanced programming logic or data structures

When NOT to use the bash_execution_sandbox tool:
- Simple questions that can be answered without executing commands
- Tasks that only require explaining shell concepts without actual execution

How it works:
- Scripts are saved to a temporary sandbox and executed with bash
- Tool results will include stdout, stderr, and return code
- User-uploaded files are accessible in the directory specified by the INPUT_DIR environment variable. If
you know the file path and don't need to open the full INPUT_DIR, then just open the file directly

File Operations (CRITICAL - READ CAREFULLY):
- use text_editor_sandbox tool to view, create, and edit files.

Export Your Result:
- All the files you created kept in the sandbox, which user can't see or access.
- If you want to export them to user, use \`export_file_sandbox\` tool.
- If too many files to export(>= 6 files), zip those files and export the zip file.
- Result files' names should be unique and descriptive, (wrong: result.md, output.md... right: 2026_us_market_trending.png)

Script guidelines:
- Write POSIX-compliant bash scripts
- Use proper error handling and exit codes
- Quote variables appropriately to handle spaces in filenames
- Keep scripts clean and well-organized
- For file operations, use text_editor_sandbox tool instead of bash commands.

Never write blocking script:
- python codes like \`plt.show()\` or \`input()\`... will block the execution of the script, don't use them. write non-blocking code instead.

Container environment:
- Filesystem persists across multiple executions within the same container
- Standard Unix utilities available (grep, sed, awk, etc.)
- Archive tools: tar, unzip, zip
- Additional tools: ripgrep, fd, sqlite3, jq, imagemagick
- You can install new packages with pip if needed (internet access is available)

Remember to always export your artifacts at the end of your task so that the user can view them.
`;
  }
});

// node_modules/@acontext/acontext/dist/agent/text-editor.js
var require_text_editor = __commonJS({
  "node_modules/@acontext/acontext/dist/agent/text-editor.js"(exports2) {
    "use strict";
    var __importDefault = exports2 && exports2.__importDefault || function(mod) {
      return mod && mod.__esModule ? mod : { "default": mod };
    };
    Object.defineProperty(exports2, "__esModule", { value: true });
    exports2.escapeForShell = escapeForShell;
    exports2.viewFile = viewFile;
    exports2.createFile = createFile;
    exports2.strReplace = strReplace;
    var path_1 = __importDefault(require("path"));
    var MAX_CONTENT_CHARS = 2e4;
    function truncateContent(text, maxChars = MAX_CONTENT_CHARS) {
      if (text.length > maxChars) {
        return text.slice(0, maxChars) + "...[truncated]";
      }
      return text;
    }
    __name(truncateContent, "truncateContent");
    function escapeForShell(s) {
      return "'" + s.replace(/'/g, `'"'"'`) + "'";
    }
    __name(escapeForShell, "escapeForShell");
    async function viewFile(ctx, filePath, viewRange, timeout) {
      const escapedPath = escapeForShell(filePath);
      let viewCmd;
      let startLine;
      if (viewRange && viewRange.length === 2) {
        const [rangeStart, rangeEnd] = viewRange;
        viewCmd = `sed -n '${rangeStart},${rangeEnd}p' ${escapedPath} | nl -ba -v ${rangeStart}`;
        startLine = rangeStart;
      } else {
        const maxLines = 200;
        viewCmd = `head -n ${maxLines} ${escapedPath} | nl -ba`;
        startLine = 1;
      }
      const cmd = `if [ ! -f ${escapedPath} ]; then echo 'FILE_NOT_FOUND'; exit 1; fi; echo "TOTAL:$(wc -l < ${escapedPath})"; ${viewCmd}`;
      const result = await ctx.client.sandboxes.execCommand({
        sandboxId: ctx.sandboxId,
        command: cmd,
        timeout
      });
      if (result.exit_code !== 0 || result.stdout.includes("FILE_NOT_FOUND")) {
        return {
          error: `File not found: ${filePath}`,
          stderr: result.stderr
        };
      }
      const lines = result.stdout.split("\n");
      let totalLines = 0;
      let content = "";
      if (lines.length > 0 && lines[0].startsWith("TOTAL:")) {
        const totalStr = lines[0].substring(6).trim();
        totalLines = /^\d+$/.test(totalStr) ? parseInt(totalStr, 10) : 0;
        content = lines.slice(1).join("\n");
      }
      const contentLines = content.trim() ? content.trimEnd().split("\n") : [];
      const numLines = contentLines.length;
      return {
        file_type: "text",
        content: truncateContent(content),
        numLines,
        startLine: viewRange ? startLine : 1,
        totalLines: totalLines + 1
        // wc -l doesn't count last line without newline
      };
    }
    __name(viewFile, "viewFile");
    async function createFile(ctx, filePath, fileText, timeout) {
      const escapedPath = escapeForShell(filePath);
      const encodedContent = Buffer.from(fileText, "utf-8").toString("base64");
      const dirPath = path_1.default.posix.dirname(filePath);
      const mkdirPart = dirPath && dirPath !== "." ? `mkdir -p ${escapeForShell(dirPath)} && ` : "";
      const cmd = `is_update=$(test -f ${escapedPath} && echo 1 || echo 0); ${mkdirPart}echo ${escapeForShell(encodedContent)} | base64 -d > ${escapedPath} && echo "STATUS:$is_update"`;
      const result = await ctx.client.sandboxes.execCommand({
        sandboxId: ctx.sandboxId,
        command: cmd,
        timeout
      });
      if (result.exit_code !== 0 || !result.stdout.includes("STATUS:")) {
        return {
          error: `Failed to create file: ${filePath}`,
          stderr: result.stderr
        };
      }
      const isUpdate = result.stdout.includes("STATUS:1");
      return {
        is_file_update: isUpdate,
        message: `File ${isUpdate ? "updated" : "created"}: ${filePath}`
      };
    }
    __name(createFile, "createFile");
    async function strReplace(ctx, filePath, oldStr, newStr, timeout) {
      const oldB64 = Buffer.from(oldStr, "utf-8").toString("base64");
      const newB64 = Buffer.from(newStr, "utf-8").toString("base64");
      const pyScript = `import sys, base64, os
old = base64.b64decode("${oldB64}").decode()
new = base64.b64decode("${newB64}").decode()
path = "${filePath}"
if not os.path.exists(path):
    print("FILE_NOT_FOUND")
    sys.exit(1)
with open(path, "r") as f:
    content = f.read()
count = content.count(old)
if count == 0:
    print("NOT_FOUND")
    sys.exit(0)
if count > 1:
    print(f"MULTIPLE:{count}")
    sys.exit(0)
with open(path, "w") as f:
    f.write(content.replace(old, new, 1))
print("SUCCESS")
`;
      const scriptB64 = Buffer.from(pyScript, "utf-8").toString("base64");
      const cmd = `echo ${escapeForShell(scriptB64)} | base64 -d | python3`;
      const result = await ctx.client.sandboxes.execCommand({
        sandboxId: ctx.sandboxId,
        command: cmd,
        timeout
      });
      const output = result.stdout.trim();
      if (result.exit_code !== 0 || output === "FILE_NOT_FOUND") {
        return { error: `File not found: ${filePath}`, stderr: result.stderr };
      }
      if (output === "NOT_FOUND") {
        return { error: `String not found in file: ${oldStr.substring(0, 50)}...` };
      }
      if (output.startsWith("MULTIPLE:")) {
        const count = output.split(":")[1];
        return {
          error: `Multiple occurrences (${count}) of the string found. Please provide more context to make the match unique.`
        };
      }
      if (output === "SUCCESS") {
        return { msg: "Successfully replaced text at exactly one location." };
      }
      return { error: `Unexpected response: ${output}`, stderr: result.stderr };
    }
    __name(strReplace, "strReplace");
  }
});

// node_modules/@acontext/acontext/dist/agent/sandbox.js
var require_sandbox2 = __commonJS({
  "node_modules/@acontext/acontext/dist/agent/sandbox.js"(exports2) {
    "use strict";
    var __createBinding = exports2 && exports2.__createBinding || (Object.create ? (function(o, m, k, k2) {
      if (k2 === void 0) k2 = k;
      var desc = Object.getOwnPropertyDescriptor(m, k);
      if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
        desc = { enumerable: true, get: /* @__PURE__ */ __name(function() {
          return m[k];
        }, "get") };
      }
      Object.defineProperty(o, k2, desc);
    }) : (function(o, m, k, k2) {
      if (k2 === void 0) k2 = k;
      o[k2] = m[k];
    }));
    var __setModuleDefault = exports2 && exports2.__setModuleDefault || (Object.create ? (function(o, v) {
      Object.defineProperty(o, "default", { enumerable: true, value: v });
    }) : function(o, v) {
      o["default"] = v;
    });
    var __importStar = exports2 && exports2.__importStar || /* @__PURE__ */ (function() {
      var ownKeys = /* @__PURE__ */ __name(function(o) {
        ownKeys = Object.getOwnPropertyNames || function(o2) {
          var ar = [];
          for (var k in o2) if (Object.prototype.hasOwnProperty.call(o2, k)) ar[ar.length] = k;
          return ar;
        };
        return ownKeys(o);
      }, "ownKeys");
      return function(mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) {
          for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        }
        __setModuleDefault(result, mod);
        return result;
      };
    })();
    Object.defineProperty(exports2, "__esModule", { value: true });
    exports2.SANDBOX_TOOLS = exports2.SandboxToolPool = exports2.ExportSandboxFileTool = exports2.TextEditorTool = exports2.BashTool = void 0;
    var path5 = __importStar(require("path"));
    var base_1 = require_base();
    var prompts_1 = require_prompts();
    var text_editor_1 = require_text_editor();
    var MAX_OUTPUT_CHARS = 2e4;
    function truncateOutput(text, maxChars = MAX_OUTPUT_CHARS) {
      if (text.length > maxChars) {
        return text.slice(0, maxChars) + "...[truncated]";
      }
      return text;
    }
    __name(truncateOutput, "truncateOutput");
    function formatMountedSkills(mountedSkillPaths) {
      if (mountedSkillPaths.size === 0) {
        return "";
      }
      const sortedSkills = Array.from(mountedSkillPaths.values()).sort((a, b) => a.name.localeCompare(b.name));
      const skillEntries = sortedSkills.map((skill) => {
        const location = path5.posix.join(skill.basePath, "SKILL.md");
        return `<skill>
<name>${skill.name}</name>
<description>${skill.description}</description>
<location>${location}</location>
</skill>`;
      });
      return skillEntries.join("\n");
    }
    __name(formatMountedSkills, "formatMountedSkills");
    function getSandboxContextPrompt(mountedSkillPaths) {
      let baseBody = `<text_editor_sandbox>
${prompts_1.SANDBOX_TEXT_EDITOR_REMINDER}
</text_editor_sandbox>
<bash_execution_sandbox>
${prompts_1.SANDBOX_BASH_REMINDER}
</bash_execution_sandbox>`;
      if (mountedSkillPaths.size > 0) {
        const formattedSkills = formatMountedSkills(mountedSkillPaths);
        baseBody += `
<skills>
${prompts_1.SKILL_REMINDER}
<available_skills>
${formattedSkills}
</available_skills>
</skills>`;
      }
      return `<sandbox>
By default, you are in \`/workspace\`.
${baseBody}
</sandbox>
`;
    }
    __name(getSandboxContextPrompt, "getSandboxContextPrompt");
    function normalizePath(path6) {
      if (!path6) {
        return "/";
      }
      let normalized = path6.startsWith("/") ? path6 : `/${path6}`;
      if (!normalized.endsWith("/")) {
        normalized += "/";
      }
      return normalized;
    }
    __name(normalizePath, "normalizePath");
    var BashTool = class extends base_1.AbstractBaseTool {
      static {
        __name(this, "BashTool");
      }
      constructor(timeout) {
        super();
        this.name = "bash_execution_sandbox";
        this.description = "The bash_execution_sandbox tool enables execution of bash scripts in a secure sandboxed container environment.";
        this.arguments = {
          command: {
            type: "string",
            description: "The bash command to execute. Examples: 'ls -la', 'python3 script.py', 'sed -i 's/old_string/new_string/g' file.py'"
          },
          timeout: {
            type: ["number", "null"],
            description: "Optional timeout in seconds for this command. Use for long-running commands that may exceed the default timeout."
          }
        };
        this.requiredArguments = ["command"];
        this._timeout = timeout;
      }
      async execute(ctx, llmArguments) {
        const command = llmArguments.command;
        const timeoutSec = llmArguments.timeout ?? this._timeout;
        const timeout = timeoutSec != null ? timeoutSec * 1e3 : void 0;
        if (!command) {
          throw new Error("command is required");
        }
        const result = await ctx.client.sandboxes.execCommand({
          sandboxId: ctx.sandboxId,
          command,
          timeout
        });
        return JSON.stringify({
          stdout: truncateOutput(result.stdout),
          stderr: truncateOutput(result.stderr),
          exit_code: result.exit_code
        });
      }
    };
    exports2.BashTool = BashTool;
    var TextEditorTool = class extends base_1.AbstractBaseTool {
      static {
        __name(this, "TextEditorTool");
      }
      constructor(timeout) {
        super();
        this.name = "text_editor_sandbox";
        this.description = "A tool for viewing, creating, and editing text files in the sandbox.";
        this.arguments = {
          command: {
            type: "string",
            enum: ["view", "create", "str_replace"],
            description: "The operation to perform: 'view', 'create', or 'str_replace'. Required parameters per command: 'view' requires path (view_range is optional); 'create' requires path and file_text; 'str_replace' requires path, old_str, and new_str."
          },
          path: {
            type: "string",
            description: "Required for all commands. The file path in the sandbox (e.g., '/workspace/script.py')"
          },
          file_text: {
            type: ["string", "null"],
            description: "Required for 'create' command. The content to write to the file."
          },
          old_str: {
            type: ["string", "null"],
            description: "Required for 'str_replace' command. The exact string to find and replace."
          },
          new_str: {
            type: ["string", "null"],
            description: "Required for 'str_replace' command. The string to replace old_str with."
          },
          view_range: {
            type: ["array", "null"],
            items: { type: "integer" },
            description: "Optional for 'view' command. An array [start_line, end_line] to view specific lines. If not provided, shows the first 200 lines."
          }
        };
        this.requiredArguments = ["command", "path"];
        this._timeout = timeout;
      }
      async execute(ctx, llmArguments) {
        const command = llmArguments.command;
        const path6 = llmArguments.path;
        const timeoutMs = this._timeout != null ? this._timeout * 1e3 : void 0;
        if (!command) {
          throw new Error("command is required");
        }
        if (!path6) {
          throw new Error("path is required");
        }
        if (command === "view") {
          const viewRange = llmArguments.view_range;
          const result = await (0, text_editor_1.viewFile)(ctx, path6, viewRange, timeoutMs);
          return JSON.stringify(result);
        } else if (command === "create") {
          const fileText = llmArguments.file_text;
          if (fileText === null || fileText === void 0) {
            throw new Error("file_text is required for create command");
          }
          const result = await (0, text_editor_1.createFile)(ctx, path6, fileText, timeoutMs);
          return JSON.stringify(result);
        } else if (command === "str_replace") {
          const oldStr = llmArguments.old_str;
          const newStr = llmArguments.new_str;
          if (oldStr === null || oldStr === void 0) {
            throw new Error("old_str is required for str_replace command");
          }
          if (newStr === null || newStr === void 0) {
            throw new Error("new_str is required for str_replace command");
          }
          const result = await (0, text_editor_1.strReplace)(ctx, path6, oldStr, newStr, timeoutMs);
          return JSON.stringify(result);
        } else {
          throw new Error(`Unknown command: ${command}. Must be 'view', 'create', or 'str_replace'`);
        }
      }
    };
    exports2.TextEditorTool = TextEditorTool;
    var ExportSandboxFileTool = class extends base_1.AbstractBaseTool {
      static {
        __name(this, "ExportSandboxFileTool");
      }
      constructor() {
        super(...arguments);
        this.name = "export_file_sandbox";
        this.description = `Export a file from the sandbox to persistent, shared disk storage, and return you a public download URL.
If the sandbox file is changed, the disk file won't be updated unless you export the file again.`;
        this.arguments = {
          sandbox_path: {
            type: "string",
            description: "The directory path in the sandbox where the file is located. Must end with '/'. Examples: '/workspace/', '/home/user/output/'"
          },
          sandbox_filename: {
            type: "string",
            description: "The name of the file to export from the sandbox."
          }
        };
        this.requiredArguments = ["sandbox_path", "sandbox_filename"];
      }
      async execute(ctx, llmArguments) {
        const sandboxPath = llmArguments.sandbox_path;
        const sandboxFilename = llmArguments.sandbox_filename;
        const diskPath = "/artifacts/";
        if (!sandboxPath) {
          throw new Error("sandbox_path is required");
        }
        if (!sandboxFilename) {
          throw new Error("sandbox_filename is required");
        }
        const normalizedSandboxPath = normalizePath(sandboxPath);
        const normalizedDiskPath = normalizePath(diskPath);
        const artifact = await ctx.client.disks.artifacts.uploadFromSandbox(ctx.diskId, {
          sandboxId: ctx.sandboxId,
          sandboxPath: normalizedSandboxPath,
          sandboxFilename,
          filePath: normalizedDiskPath
        });
        const artifactInfo = await ctx.client.disks.artifacts.get(ctx.diskId, {
          filePath: artifact.path,
          filename: artifact.filename,
          withPublicUrl: true,
          withContent: false
        });
        return JSON.stringify({
          message: "successfully exported file to disk",
          public_url: artifactInfo.public_url
        });
      }
    };
    exports2.ExportSandboxFileTool = ExportSandboxFileTool;
    var SandboxToolPool = class extends base_1.BaseToolPool {
      static {
        __name(this, "SandboxToolPool");
      }
      /**
       * Create a sandbox context.
       *
       * @param client - The Acontext client instance.
       * @param sandboxId - The UUID of the sandbox.
       * @param diskId - The UUID of the disk for file exports.
       * @param mountSkills - Optional list of skill IDs to download to the sandbox.
       *                     Skills are downloaded to /skills/{skill_name}/ in the sandbox.
       * @returns Promise resolving to SandboxContext for use with sandbox tools.
       */
      async formatContext(client, sandboxId, diskId, mountSkills) {
        const mountedSkillPaths = /* @__PURE__ */ new Map();
        const ctx = {
          client,
          sandboxId,
          diskId,
          mountedSkillPaths,
          getContextPrompt() {
            return getSandboxContextPrompt(mountedSkillPaths);
          },
          formatMountedSkills() {
            return formatMountedSkills(mountedSkillPaths);
          },
          async mountSkills(skillIds) {
            for (const skillId of skillIds) {
              if (mountedSkillPaths.has(skillId)) {
                continue;
              }
              const result = await client.skills.downloadToSandbox(skillId, {
                sandboxId
              });
              if (result.success) {
                mountedSkillPaths.set(skillId, {
                  basePath: result.dir_path,
                  name: result.name,
                  description: result.description
                });
              }
            }
          }
        };
        if (mountSkills && mountSkills.length > 0) {
          await ctx.mountSkills(mountSkills);
        }
        return ctx;
      }
    };
    exports2.SandboxToolPool = SandboxToolPool;
    exports2.SANDBOX_TOOLS = new SandboxToolPool();
    exports2.SANDBOX_TOOLS.addTool(new BashTool());
    exports2.SANDBOX_TOOLS.addTool(new TextEditorTool());
    exports2.SANDBOX_TOOLS.addTool(new ExportSandboxFileTool());
  }
});

// node_modules/@acontext/acontext/dist/agent/skill.js
var require_skill2 = __commonJS({
  "node_modules/@acontext/acontext/dist/agent/skill.js"(exports2) {
    "use strict";
    Object.defineProperty(exports2, "__esModule", { value: true });
    exports2.SKILL_TOOLS = exports2.SkillToolPool = exports2.GetSkillFileTool = exports2.GetSkillTool = void 0;
    exports2.createSkillContext = createSkillContext;
    exports2.getSkillFromContext = getSkillFromContext;
    exports2.listSkillNamesFromContext = listSkillNamesFromContext;
    var base_1 = require_base();
    async function createSkillContext(client, skillIds) {
      const skills = /* @__PURE__ */ new Map();
      for (const skillId of skillIds) {
        const skill = await client.skills.get(skillId);
        if (skills.has(skill.name)) {
          const existingSkill = skills.get(skill.name);
          throw new Error(`Duplicate skill name '${skill.name}' found. Existing ID: ${existingSkill.id}, New ID: ${skill.id}`);
        }
        skills.set(skill.name, skill);
      }
      return {
        client,
        skills,
        getContextPrompt() {
          if (skills.size === 0) {
            return "";
          }
          const lines = ["<available_skills>"];
          for (const [skillName, skill] of skills.entries()) {
            lines.push("<skill>");
            lines.push(`<name>${skillName}</name>`);
            lines.push(`<description>${skill.description}</description>`);
            lines.push("</skill>");
          }
          lines.push("</available_skills>");
          const skillSection = lines.join("\n");
          return `<skill_view>
Use get_skill and get_skill_file to view the available skills and their contexts.
Below is the list of available skills:
${skillSection}        
</skill_view>
`;
        }
      };
    }
    __name(createSkillContext, "createSkillContext");
    function getSkillFromContext(ctx, skillName) {
      const skill = ctx.skills.get(skillName);
      if (!skill) {
        const available = ctx.skills.size > 0 ? Array.from(ctx.skills.keys()).join(", ") : "[none]";
        throw new Error(`Skill '${skillName}' not found in context. Available skills: ${available}`);
      }
      return skill;
    }
    __name(getSkillFromContext, "getSkillFromContext");
    function listSkillNamesFromContext(ctx) {
      return Array.from(ctx.skills.keys());
    }
    __name(listSkillNamesFromContext, "listSkillNamesFromContext");
    var GetSkillTool = class extends base_1.AbstractBaseTool {
      static {
        __name(this, "GetSkillTool");
      }
      constructor() {
        super(...arguments);
        this.name = "get_skill";
        this.description = "Get a skill by its name. Returns the skill information including the relative paths of the files and their mime type categories.";
        this.arguments = {
          skill_name: {
            type: "string",
            description: "The name of the skill."
          }
        };
        this.requiredArguments = ["skill_name"];
      }
      async execute(ctx, llmArguments) {
        const skillName = llmArguments.skill_name;
        if (!skillName) {
          throw new Error("skill_name is required");
        }
        const skill = getSkillFromContext(ctx, skillName);
        const fileCount = skill.file_index.length;
        let fileList;
        if (skill.file_index.length > 0) {
          fileList = skill.file_index.map((file) => `  - ${file.path} (${file.mime})`).join("\n");
        } else {
          fileList = "  [NO FILES]";
        }
        return `Skill: ${skill.name} (ID: ${skill.id})
Description: ${skill.description}
Files: ${fileCount} file(s)
${fileList}`;
      }
    };
    exports2.GetSkillTool = GetSkillTool;
    var GetSkillFileTool = class extends base_1.AbstractBaseTool {
      static {
        __name(this, "GetSkillFileTool");
      }
      constructor() {
        super(...arguments);
        this.name = "get_skill_file";
        this.description = "Get a file from a skill by name. The file_path should be a relative path within the skill (e.g., 'scripts/extract_text.json').Tips: SKILL.md is the first file you should read to understand the full picture of this skill's content.";
        this.arguments = {
          skill_name: {
            type: "string",
            description: "The name of the skill."
          },
          file_path: {
            type: "string",
            description: "Relative path to the file within the skill (e.g., 'scripts/extract_text.json')."
          },
          expire: {
            type: ["integer", "null"],
            description: "URL expiration time in seconds (only used for non-parseable files). Defaults to 900 (15 minutes)."
          }
        };
        this.requiredArguments = ["skill_name", "file_path"];
      }
      async execute(ctx, llmArguments) {
        const skillName = llmArguments.skill_name;
        const filePath = llmArguments.file_path;
        const expire = llmArguments.expire;
        if (!skillName) {
          throw new Error("skill_name is required");
        }
        if (!filePath) {
          throw new Error("file_path is required");
        }
        const skill = getSkillFromContext(ctx, skillName);
        const result = await ctx.client.skills.getFile({
          skillId: skill.id,
          filePath,
          expire: expire || null
        });
        const outputParts = [
          `File '${result.path}' (MIME: ${result.mime}) from skill '${skillName}':`
        ];
        if (result.content) {
          outputParts.push(`
Content (type: ${result.content.type}):`);
          outputParts.push(result.content.raw);
        }
        if (result.url) {
          const expireSeconds = expire || 900;
          outputParts.push(`
Download URL (expires in ${expireSeconds} seconds):`);
          outputParts.push(result.url);
        }
        if (!result.content && !result.url) {
          return `File '${filePath}' retrieved but no content or URL returned.`;
        }
        return outputParts.join("\n");
      }
    };
    exports2.GetSkillFileTool = GetSkillFileTool;
    var SkillToolPool = class extends base_1.BaseToolPool {
      static {
        __name(this, "SkillToolPool");
      }
      /**
       * Create a SkillContext by preloading skills from a list of skill IDs.
       *
       * @param client - The Acontext client instance.
       * @param skillIds - List of skill UUIDs to preload.
       * @returns Promise resolving to SkillContext with preloaded skills mapped by name.
       */
      async formatContext(client, skillIds) {
        return createSkillContext(client, skillIds);
      }
    };
    exports2.SkillToolPool = SkillToolPool;
    exports2.SKILL_TOOLS = new SkillToolPool();
    exports2.SKILL_TOOLS.addTool(new GetSkillTool());
    exports2.SKILL_TOOLS.addTool(new GetSkillFileTool());
  }
});

// node_modules/@acontext/acontext/dist/agent/index.js
var require_agent = __commonJS({
  "node_modules/@acontext/acontext/dist/agent/index.js"(exports2) {
    "use strict";
    var __createBinding = exports2 && exports2.__createBinding || (Object.create ? (function(o, m, k, k2) {
      if (k2 === void 0) k2 = k;
      var desc = Object.getOwnPropertyDescriptor(m, k);
      if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
        desc = { enumerable: true, get: /* @__PURE__ */ __name(function() {
          return m[k];
        }, "get") };
      }
      Object.defineProperty(o, k2, desc);
    }) : (function(o, m, k, k2) {
      if (k2 === void 0) k2 = k;
      o[k2] = m[k];
    }));
    var __exportStar = exports2 && exports2.__exportStar || function(m, exports3) {
      for (var p in m) if (p !== "default" && !Object.prototype.hasOwnProperty.call(exports3, p)) __createBinding(exports3, m, p);
    };
    Object.defineProperty(exports2, "__esModule", { value: true });
    __exportStar(require_base(), exports2);
    __exportStar(require_disk2(), exports2);
    __exportStar(require_prompts(), exports2);
    __exportStar(require_sandbox2(), exports2);
    __exportStar(require_skill2(), exports2);
  }
});

// node_modules/@acontext/acontext/dist/integrations/claude-agent.js
var require_claude_agent = __commonJS({
  "node_modules/@acontext/acontext/dist/integrations/claude-agent.js"(exports2) {
    "use strict";
    Object.defineProperty(exports2, "__esModule", { value: true });
    exports2.ClaudeAgentStorage = void 0;
    exports2.getSessionIdFromMessage = getSessionIdFromMessage;
    exports2.claudeUserMessageToAnthropicBlob = claudeUserMessageToAnthropicBlob;
    exports2.claudeAssistantMessageToAnthropicBlob = claudeAssistantMessageToAnthropicBlob;
    var errors_1 = require_errors();
    function isUserMessage(msg) {
      return msg.type === "user" && !msg.isReplay;
    }
    __name(isUserMessage, "isUserMessage");
    function isAssistantMessage(msg) {
      return msg.type === "assistant";
    }
    __name(isAssistantMessage, "isAssistantMessage");
    function isReplayMessage(msg) {
      return msg.type === "user" && msg.isReplay === true;
    }
    __name(isReplayMessage, "isReplayMessage");
    var UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    function validateSessionId(sid) {
      if (!UUID_RE.test(sid)) {
        console.warn(`Ignoring non-UUID session_id from Claude stream: "${sid}"`);
        return null;
      }
      return sid;
    }
    __name(validateSessionId, "validateSessionId");
    function getSessionIdFromMessage(msg) {
      if (msg.type === "user" || msg.type === "assistant") {
        return null;
      }
      const sid = msg.session_id;
      if (typeof sid !== "string") {
        return null;
      }
      return validateSessionId(sid);
    }
    __name(getSessionIdFromMessage, "getSessionIdFromMessage");
    function normalizeToolResultContent(content) {
      if (content === null || content === void 0) {
        return "";
      }
      if (typeof content === "string") {
        return content;
      }
      if (Array.isArray(content)) {
        return content.map((item) => ({
          type: "text",
          text: item?.text ?? ""
        }));
      }
      return String(content);
    }
    __name(normalizeToolResultContent, "normalizeToolResultContent");
    function convertBlock(block, role, includeThinking) {
      const blockType = block.type;
      switch (blockType) {
        case "thinking": {
          if (!includeThinking) {
            return null;
          }
          const thinkingText = block.thinking;
          if (!thinkingText) {
            return null;
          }
          return {
            type: "thinking",
            thinking: thinkingText,
            signature: block.signature ?? ""
          };
        }
        case "tool_use": {
          if (role !== "assistant") {
            return null;
          }
          let inputVal = block.input;
          if (typeof inputVal === "string") {
            try {
              inputVal = JSON.parse(inputVal);
            } catch {
              inputVal = { raw: inputVal };
            }
          }
          return {
            type: "tool_use",
            id: block.id,
            name: block.name,
            input: inputVal
          };
        }
        case "tool_result": {
          if (role !== "user") {
            return null;
          }
          const result = {
            type: "tool_result",
            tool_use_id: block.tool_use_id,
            content: normalizeToolResultContent(block.content)
          };
          if (block.is_error) {
            result.is_error = true;
          }
          return result;
        }
        case "text": {
          const text = block.text;
          if (!text) {
            return null;
          }
          return { type: "text", text };
        }
        default:
          return null;
      }
    }
    __name(convertBlock, "convertBlock");
    function convertContentBlocks(content, role, includeThinking) {
      let hasThinking = false;
      if (typeof content === "string") {
        if (!content) {
          return [[], false];
        }
        return [[{ type: "text", text: content }], false];
      }
      if (!Array.isArray(content)) {
        return [[], false];
      }
      const blocks = [];
      for (const block of content) {
        if (typeof block !== "object" || block === null) {
          continue;
        }
        const converted = convertBlock(block, role, includeThinking);
        if (converted !== null) {
          blocks.push(converted);
          if (block.type === "thinking" && includeThinking) {
            hasThinking = true;
          }
        }
      }
      return [blocks, hasThinking];
    }
    __name(convertContentBlocks, "convertContentBlocks");
    function claudeUserMessageToAnthropicBlob(msg) {
      const message = msg.message;
      const content = message?.content ?? "";
      const [blocks] = convertContentBlocks(content, "user", false);
      if (blocks.length === 0) {
        return null;
      }
      return { role: "user", content: blocks };
    }
    __name(claudeUserMessageToAnthropicBlob, "claudeUserMessageToAnthropicBlob");
    function claudeAssistantMessageToAnthropicBlob(msg, includeThinking = false) {
      const message = msg.message;
      const content = message?.content ?? [];
      const [blocks, hasThinking] = convertContentBlocks(content, "assistant", includeThinking);
      if (blocks.length === 0) {
        return { blob: null, hasThinking };
      }
      return {
        blob: { role: "assistant", content: blocks },
        hasThinking
      };
    }
    __name(claudeAssistantMessageToAnthropicBlob, "claudeAssistantMessageToAnthropicBlob");
    var ClaudeAgentStorage = class {
      static {
        __name(this, "ClaudeAgentStorage");
      }
      constructor(options) {
        this._sessionEnsured = false;
        this._client = options.client;
        this._sessionId = options.sessionId ?? null;
        this._user = options.user ?? null;
        this._includeThinking = options.includeThinking ?? false;
        this._onError = options.onError ?? null;
      }
      // -- properties ----------------------------------------------------------
      /**
       * The current Acontext session id (may be `null` until resolved).
       */
      get sessionId() {
        return this._sessionId;
      }
      // -- public API ----------------------------------------------------------
      /**
       * Persist a single Claude Agent SDK message to Acontext.
       *
       * - User and assistant messages are stored.
       * - All other message types (system, result, stream_event, etc.) are used
       *   only for session-id resolution and are **not** stored.
       * - Replay messages (`isReplay: true`) are skipped to prevent duplicates.
       * - API errors are caught and either forwarded to `onError` or logged,
       *   so the caller's `for await` loop is never interrupted.
       */
      async saveMessage(msg) {
        if (msg.type !== "user" && msg.type !== "assistant") {
          this._tryUpdateSessionId(msg);
          return;
        }
        if (isReplayMessage(msg)) {
          return;
        }
        if (isAssistantMessage(msg)) {
          return this._storeAssistant(msg);
        }
        if (isUserMessage(msg)) {
          return this._storeUser(msg);
        }
      }
      // -- internal helpers ----------------------------------------------------
      _tryUpdateSessionId(msg) {
        if (this._sessionId !== null) {
          return;
        }
        const sid = getSessionIdFromMessage(msg);
        if (sid) {
          this._sessionId = sid;
          console.debug(`Resolved session_id=${sid} from message`);
        }
      }
      // -- private store methods -----------------------------------------------
      async _storeUser(msg) {
        const blob = claudeUserMessageToAnthropicBlob(msg);
        if (blob === null) {
          console.debug("UserMessage produced empty content after conversion \u2013 skipping.");
          return;
        }
        await this._callStore(blob, null);
      }
      async _storeAssistant(msg) {
        const { blob, hasThinking } = claudeAssistantMessageToAnthropicBlob(msg, this._includeThinking);
        if (blob === null) {
          console.debug("AssistantMessage produced empty content after conversion \u2013 skipping.");
          return;
        }
        const meta = {};
        const message = msg.message;
        const model = message?.model;
        if (model) {
          meta.model = model;
        }
        if (hasThinking) {
          meta.has_thinking = true;
        }
        const error = msg.error;
        if (error) {
          meta.error = error;
        }
        await this._callStore(blob, Object.keys(meta).length > 0 ? meta : null);
      }
      async _ensureSession() {
        if (this._sessionEnsured) {
          return;
        }
        try {
          const session = await this._client.sessions.create({
            useUuid: this._sessionId ? this._sessionId : null,
            user: this._user
          });
          this._sessionId = session.id;
          console.debug(`Created Acontext session ${this._sessionId}`);
        } catch (err) {
          if (err instanceof errors_1.APIError && err.statusCode === 409) {
            console.debug(`Session ${this._sessionId} already exists (409) \u2013 continuing.`);
          } else {
            throw err;
          }
        }
        this._sessionEnsured = true;
      }
      async _callStore(blob, meta) {
        try {
          await this._ensureSession();
          await this._client.sessions.storeMessage(this._sessionId, blob, {
            format: "anthropic",
            meta
          });
        } catch (err) {
          if (this._onError) {
            this._onError(err, blob);
          } else {
            console.warn(`Failed to store message (session=${this._sessionId}):`, err);
          }
        }
      }
    };
    exports2.ClaudeAgentStorage = ClaudeAgentStorage;
  }
});

// node_modules/@acontext/acontext/dist/integrations/index.js
var require_integrations = __commonJS({
  "node_modules/@acontext/acontext/dist/integrations/index.js"(exports2) {
    "use strict";
    var __createBinding = exports2 && exports2.__createBinding || (Object.create ? (function(o, m, k, k2) {
      if (k2 === void 0) k2 = k;
      var desc = Object.getOwnPropertyDescriptor(m, k);
      if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
        desc = { enumerable: true, get: /* @__PURE__ */ __name(function() {
          return m[k];
        }, "get") };
      }
      Object.defineProperty(o, k2, desc);
    }) : (function(o, m, k, k2) {
      if (k2 === void 0) k2 = k;
      o[k2] = m[k];
    }));
    var __exportStar = exports2 && exports2.__exportStar || function(m, exports3) {
      for (var p in m) if (p !== "default" && !Object.prototype.hasOwnProperty.call(exports3, p)) __createBinding(exports3, m, p);
    };
    Object.defineProperty(exports2, "__esModule", { value: true });
    __exportStar(require_claude_agent(), exports2);
  }
});

// node_modules/@acontext/acontext/dist/index.js
var require_dist = __commonJS({
  "node_modules/@acontext/acontext/dist/index.js"(exports2) {
    "use strict";
    var __createBinding = exports2 && exports2.__createBinding || (Object.create ? (function(o, m, k, k2) {
      if (k2 === void 0) k2 = k;
      var desc = Object.getOwnPropertyDescriptor(m, k);
      if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
        desc = { enumerable: true, get: /* @__PURE__ */ __name(function() {
          return m[k];
        }, "get") };
      }
      Object.defineProperty(o, k2, desc);
    }) : (function(o, m, k, k2) {
      if (k2 === void 0) k2 = k;
      o[k2] = m[k];
    }));
    var __exportStar = exports2 && exports2.__exportStar || function(m, exports3) {
      for (var p in m) if (p !== "default" && !Object.prototype.hasOwnProperty.call(exports3, p)) __createBinding(exports3, m, p);
    };
    Object.defineProperty(exports2, "__esModule", { value: true });
    exports2.TextEvent = exports2.DiskEvent = exports2.TimeoutError = exports2.AcontextError = exports2.TransportError = exports2.APIError = exports2.buildAcontextMessage = exports2.AcontextMessage = exports2.MessagePart = exports2.FileUpload = exports2.AcontextClient = void 0;
    var client_1 = require_client();
    Object.defineProperty(exports2, "AcontextClient", { enumerable: true, get: /* @__PURE__ */ __name(function() {
      return client_1.AcontextClient;
    }, "get") });
    var uploads_1 = require_uploads();
    Object.defineProperty(exports2, "FileUpload", { enumerable: true, get: /* @__PURE__ */ __name(function() {
      return uploads_1.FileUpload;
    }, "get") });
    var messages_1 = require_messages();
    Object.defineProperty(exports2, "MessagePart", { enumerable: true, get: /* @__PURE__ */ __name(function() {
      return messages_1.MessagePart;
    }, "get") });
    Object.defineProperty(exports2, "AcontextMessage", { enumerable: true, get: /* @__PURE__ */ __name(function() {
      return messages_1.AcontextMessage;
    }, "get") });
    Object.defineProperty(exports2, "buildAcontextMessage", { enumerable: true, get: /* @__PURE__ */ __name(function() {
      return messages_1.buildAcontextMessage;
    }, "get") });
    var errors_1 = require_errors();
    Object.defineProperty(exports2, "APIError", { enumerable: true, get: /* @__PURE__ */ __name(function() {
      return errors_1.APIError;
    }, "get") });
    Object.defineProperty(exports2, "TransportError", { enumerable: true, get: /* @__PURE__ */ __name(function() {
      return errors_1.TransportError;
    }, "get") });
    Object.defineProperty(exports2, "AcontextError", { enumerable: true, get: /* @__PURE__ */ __name(function() {
      return errors_1.AcontextError;
    }, "get") });
    Object.defineProperty(exports2, "TimeoutError", { enumerable: true, get: /* @__PURE__ */ __name(function() {
      return errors_1.TimeoutError;
    }, "get") });
    var events_1 = require_events();
    Object.defineProperty(exports2, "DiskEvent", { enumerable: true, get: /* @__PURE__ */ __name(function() {
      return events_1.DiskEvent;
    }, "get") });
    Object.defineProperty(exports2, "TextEvent", { enumerable: true, get: /* @__PURE__ */ __name(function() {
      return events_1.TextEvent;
    }, "get") });
    __exportStar(require_types(), exports2);
    __exportStar(require_resources(), exports2);
    __exportStar(require_agent(), exports2);
    __exportStar(require_integrations(), exports2);
  }
});

// src/hook-handler.ts
var path4 = __toESM(require("node:path"));

// src/bridge.ts
var crypto = __toESM(require("node:crypto"));
var fs = __toESM(require("node:fs/promises"));
var path = __toESM(require("node:path"));
function sanitizeSkillName(name) {
  const sanitized = name.trim().toLowerCase().replace(/[^a-z0-9_-]+/g, "-").replace(/^-+|-+$/g, "");
  if (!sanitized) {
    throw new Error(
      `Cannot sanitize skill name to valid directory name: "${name}"`
    );
  }
  return sanitized;
}
__name(sanitizeSkillName, "sanitizeSkillName");
var atomicWriteCounter = 0;
async function atomicWriteFile(filePath, data) {
  await fs.mkdir(path.dirname(filePath), { recursive: true });
  const tmpPath = filePath + `.tmp.${process.pid}.${Date.now()}.${atomicWriteCounter++}`;
  await fs.writeFile(tmpPath, data, "utf-8");
  try {
    await fs.rename(tmpPath, filePath);
  } catch (err) {
    await fs.unlink(tmpPath).catch(() => {
    });
    throw err;
  }
}
__name(atomicWriteFile, "atomicWriteFile");
var SOURCE_TAG = "claude-code";
var AcontextBridge = class _AcontextBridge {
  constructor(cfg, dataDir, logger2) {
    this.cfg = cfg;
    this.dataDir = dataDir;
    this.skillsDir = cfg.skillsDir;
    this.logger = logger2 ?? { info: /* @__PURE__ */ __name(() => {
    }, "info"), warn: /* @__PURE__ */ __name(() => {
    }, "warn") };
    if (cfg.learningSpaceId) {
      this.learningSpaceId = cfg.learningSpaceId;
    }
  }
  static {
    __name(this, "AcontextBridge");
  }
  client = null;
  initPromise = null;
  sessionId = null;
  sessionPromise = null;
  learningSpaceId = null;
  learningSpacePromise = null;
  logger;
  dataDir;
  skillsDir;
  skillsMetadata = null;
  skillsSynced = false;
  syncInProgress = null;
  learnedSessions = /* @__PURE__ */ new Set();
  learnedSessionsLoaded = false;
  learnedSessionsLoadPromise = null;
  sentMessages = /* @__PURE__ */ new Map();
  sentMessagesLoaded = false;
  sentMessagesLoadPromise = null;
  turnCount = 0;
  lastProcessedIndex = 0;
  static MANIFEST_STALE_MS = 30 * 60 * 1e3;
  // 30 minutes
  static MAX_SENT_SESSIONS = 100;
  static MAX_LEARNED_SESSIONS = 500;
  // -- Persistence paths ----------------------------------------------------
  sessionStatePath() {
    return path.join(this.dataDir, ".session-state.json");
  }
  manifestPath() {
    return path.join(this.dataDir, ".manifest.json");
  }
  learnedSessionsPath() {
    return path.join(this.dataDir, ".learned-sessions.json");
  }
  sentMessagesPath() {
    return path.join(this.dataDir, ".sent-messages.json");
  }
  skillDir(skillName) {
    return path.join(this.skillsDir, sanitizeSkillName(skillName));
  }
  // -- Session state persistence (across hook processes) --------------------
  async saveSessionState() {
    if (!this.sessionId) return;
    await fs.mkdir(this.dataDir, { recursive: true });
    await atomicWriteFile(
      this.sessionStatePath(),
      JSON.stringify({
        sessionId: this.sessionId,
        turnCount: this.turnCount,
        lastProcessedIndex: this.lastProcessedIndex,
        timestamp: Date.now()
      })
    );
  }
  async loadSessionState() {
    try {
      const raw = await fs.readFile(this.sessionStatePath(), "utf-8");
      const state = JSON.parse(raw);
      if (Date.now() - state.timestamp > 24 * 60 * 60 * 1e3) {
        return false;
      }
      this.sessionId = state.sessionId;
      this.turnCount = state.turnCount;
      this.lastProcessedIndex = state.lastProcessedIndex ?? 0;
      return true;
    } catch {
      return false;
    }
  }
  async clearSessionState() {
    await fs.unlink(this.sessionStatePath()).catch(() => {
    });
  }
  // -- Learned sessions persistence -----------------------------------------
  async loadLearnedSessions() {
    try {
      const raw = await fs.readFile(this.learnedSessionsPath(), "utf-8");
      const ids = JSON.parse(raw);
      for (const id of ids) this.learnedSessions.add(id);
    } catch (err) {
      if (err?.code !== "ENOENT") {
        this.logger.warn(
          `acontext: failed to load learned-sessions state: ${String(err)}`
        );
      }
    }
  }
  async persistLearnedSessions() {
    if (this.learnedSessions.size > _AcontextBridge.MAX_LEARNED_SESSIONS) {
      const arr = [...this.learnedSessions];
      const toKeep = arr.slice(
        arr.length - _AcontextBridge.MAX_LEARNED_SESSIONS
      );
      this.learnedSessions = new Set(toKeep);
    }
    await fs.mkdir(this.dataDir, { recursive: true });
    await atomicWriteFile(
      this.learnedSessionsPath(),
      JSON.stringify([...this.learnedSessions])
    );
  }
  // -- Sent messages persistence --------------------------------------------
  async loadSentMessages() {
    try {
      const raw = await fs.readFile(this.sentMessagesPath(), "utf-8");
      const data = JSON.parse(raw);
      for (const [sessionId, hashes] of Object.entries(data)) {
        this.sentMessages.set(sessionId, new Map(Object.entries(hashes)));
      }
    } catch (err) {
      if (err?.code !== "ENOENT") {
        this.logger.warn(
          `acontext: failed to load sent-messages state: ${String(err)}`
        );
      }
    }
  }
  async persistSentMessages() {
    if (this.sentMessages.size > _AcontextBridge.MAX_SENT_SESSIONS) {
      const keys = [...this.sentMessages.keys()];
      const toRemove = keys.slice(
        0,
        keys.length - _AcontextBridge.MAX_SENT_SESSIONS
      );
      for (const key of toRemove) {
        this.sentMessages.delete(key);
      }
    }
    await fs.mkdir(this.dataDir, { recursive: true });
    const data = {};
    for (const [sessionId, hashes] of this.sentMessages) {
      data[sessionId] = Object.fromEntries(hashes);
    }
    await atomicWriteFile(this.sentMessagesPath(), JSON.stringify(data));
  }
  static computeMessageHash(index, blob) {
    const hash = crypto.createHash("sha256").update(JSON.stringify({ i: index, r: blob.role, c: blob.content })).digest("hex").slice(0, 16);
    return `${index}:${hash}`;
  }
  // -- Client initialization ------------------------------------------------
  async ensureClient() {
    if (this.client) return this.client;
    if (!this.initPromise) {
      this.initPromise = this._init().catch((err) => {
        this.initPromise = null;
        throw err;
      });
    }
    await this.initPromise;
    return this.client;
  }
  async _init() {
    const { AcontextClient } = await Promise.resolve().then(() => __toESM(require_dist()));
    this.client = new AcontextClient({
      apiKey: this.cfg.apiKey,
      baseUrl: this.cfg.baseUrl
    });
  }
  // -- Session management ---------------------------------------------------
  async ensureSession() {
    if (this.sessionId) return this.sessionId;
    if (this.sessionPromise) return this.sessionPromise;
    this.sessionPromise = this._createSession().then(
      (result) => {
        this.sessionPromise = null;
        return result;
      },
      (err) => {
        this.sessionPromise = null;
        throw err;
      }
    );
    return this.sessionPromise;
  }
  async _createSession() {
    const client = await this.ensureClient();
    const session = await client.sessions.create({
      user: this.cfg.userId,
      configs: {
        source: SOURCE_TAG
      }
    });
    this.sessionId = session.id;
    this.turnCount = 0;
    this.lastProcessedIndex = 0;
    this.logger.info(`acontext: created session ${session.id}`);
    return session.id;
  }
  getSessionId() {
    return this.sessionId;
  }
  getTurnCount() {
    return this.turnCount;
  }
  incrementTurnCount() {
    this.turnCount++;
  }
  resetTurnCount() {
    this.turnCount = 0;
  }
  getLastProcessedIndex() {
    return this.lastProcessedIndex;
  }
  setLastProcessedIndex(index) {
    this.lastProcessedIndex = index;
  }
  // -- Learning space management --------------------------------------------
  async ensureLearningSpace() {
    if (this.learningSpaceId) return this.learningSpaceId;
    if (this.learningSpacePromise) return this.learningSpacePromise;
    this.learningSpacePromise = this._createOrFindLearningSpace().then(
      (result) => {
        this.learningSpacePromise = null;
        return result;
      },
      (err) => {
        this.learningSpacePromise = null;
        throw err;
      }
    );
    return this.learningSpacePromise;
  }
  async _createOrFindLearningSpace() {
    const client = await this.ensureClient();
    const existing = await client.learningSpaces.list({
      user: this.cfg.userId,
      filterByMeta: { source: SOURCE_TAG },
      limit: 1
    });
    if (existing.items.length > 0) {
      this.learningSpaceId = existing.items[0].id;
      return this.learningSpaceId;
    }
    const space = await client.learningSpaces.create({
      user: this.cfg.userId,
      meta: { source: SOURCE_TAG }
    });
    this.learningSpaceId = space.id;
    return this.learningSpaceId;
  }
  // -- Message capture ------------------------------------------------------
  async storeMessages(sessionId, blobs, startIndex = 0) {
    if (!this.sentMessagesLoaded) {
      if (!this.sentMessagesLoadPromise) {
        this.sentMessagesLoadPromise = this.loadSentMessages().then(() => {
          this.sentMessagesLoaded = true;
          this.sentMessagesLoadPromise = null;
        }).catch((err) => {
          this.sentMessagesLoadPromise = null;
          throw err;
        });
      }
      await this.sentMessagesLoadPromise;
    }
    const client = await this.ensureClient();
    let sessionSent = this.sentMessages.get(sessionId);
    if (!sessionSent) {
      sessionSent = /* @__PURE__ */ new Map();
      this.sentMessages.set(sessionId, sessionSent);
    }
    let stored = 0;
    let processed = 0;
    for (let i = 0; i < blobs.length; i++) {
      const blob = blobs[i];
      const hash = _AcontextBridge.computeMessageHash(startIndex + i, blob);
      if (sessionSent.has(hash)) {
        processed++;
        continue;
      }
      try {
        const result = await client.sessions.storeMessage(sessionId, blob, {
          format: "anthropic"
        });
        sessionSent.set(hash, result.id);
        stored++;
        processed++;
      } catch (err) {
        this.logger.warn(
          `acontext: storeMessage failed at index ${startIndex + i}: ${String(err)}`
        );
        break;
      }
    }
    if (stored > 0) {
      await this.persistSentMessages();
    }
    return { stored, processed };
  }
  async flush(sessionId) {
    const client = await this.ensureClient();
    return await client.sessions.flush(sessionId);
  }
  // -- Learning -------------------------------------------------------------
  async learnFromSession(sessionId) {
    if (!this.learnedSessionsLoaded) {
      if (!this.learnedSessionsLoadPromise) {
        this.learnedSessionsLoadPromise = this.loadLearnedSessions().then(() => {
          this.learnedSessionsLoaded = true;
          this.learnedSessionsLoadPromise = null;
        }).catch((err) => {
          this.learnedSessionsLoadPromise = null;
          throw err;
        });
      }
      await this.learnedSessionsLoadPromise;
    }
    if (this.learnedSessions.has(sessionId)) {
      return { status: "skipped" };
    }
    const client = await this.ensureClient();
    const spaceId = await this.ensureLearningSpace();
    try {
      const result = await client.learningSpaces.learn({
        spaceId,
        sessionId
      });
      this.learnedSessions.add(sessionId);
      await this.persistLearnedSessions();
      this.invalidateSkillCaches();
      return { status: "learned", id: result.id };
    } catch (err) {
      const msg = String(err);
      if (msg.includes("already learned")) {
        this.learnedSessions.add(sessionId);
        await this.persistLearnedSessions();
        this.invalidateSkillCaches();
        this.logger.info(
          `acontext: session ${sessionId} already learned, skipping`
        );
        return { status: "skipped" };
      }
      this.logger.warn(
        `acontext: learnFromSession failed for ${sessionId}: ${msg}`
      );
      return { status: "error" };
    }
  }
  invalidateSkillCaches() {
    this.skillsMetadata = null;
    this.skillsSynced = false;
  }
  // -- Skill manifest & sync ------------------------------------------------
  async readManifest() {
    try {
      const raw = await fs.readFile(this.manifestPath(), "utf-8");
      return JSON.parse(raw);
    } catch {
      return null;
    }
  }
  async writeManifest(skills) {
    await fs.mkdir(this.dataDir, { recursive: true });
    const manifest = { syncedAt: Date.now(), skills };
    await atomicWriteFile(this.manifestPath(), JSON.stringify(manifest));
  }
  /**
   * Download .md files for a single skill into the local skills directory.
   */
  async downloadSkillFiles(skill) {
    const client = await this.ensureClient();
    const dir = this.skillDir(skill.name);
    let allSucceeded = true;
    for (const fi of skill.fileIndex) {
      if (!fi.path.endsWith(".md")) continue;
      const fileDest = path.resolve(dir, fi.path);
      const rel = path.relative(dir, fileDest);
      if (rel.startsWith("..") || path.isAbsolute(rel)) {
        this.logger.warn(
          `acontext: skipping file with path traversal: ${fi.path} (skill: ${skill.name})`
        );
        continue;
      }
      await fs.mkdir(path.dirname(fileDest), { recursive: true });
      try {
        const resp = await client.skills.getFile({
          skillId: skill.id,
          filePath: fi.path,
          expire: 60
        });
        if (resp.content) {
          if (resp.content.type === "base64") {
            await fs.writeFile(
              fileDest,
              Buffer.from(resp.content.raw, "base64")
            );
          } else {
            await fs.writeFile(fileDest, resp.content.raw, "utf-8");
          }
        } else if (resp.url) {
          const res = await fetch(resp.url);
          if (res.ok) {
            await fs.writeFile(
              fileDest,
              Buffer.from(await res.arrayBuffer())
            );
          } else {
            allSucceeded = false;
          }
        } else {
          this.logger.warn(
            `acontext: empty response for ${skill.id}:${fi.path} (no content or url)`
          );
          allSucceeded = false;
        }
      } catch (err) {
        this.logger.warn(
          `acontext: download failed for ${skill.id}:${fi.path}: ${String(err)}`
        );
        allSucceeded = false;
      }
    }
    return allSucceeded;
  }
  /**
   * Sync skills from API to local skills directory.
   * Uses updated_at for incremental sync — only downloads new or changed skills.
   * Concurrent calls are deduplicated via a promise guard.
   */
  async syncSkillsToLocal() {
    if (this.syncInProgress) return this.syncInProgress;
    this.syncInProgress = this._doSync();
    try {
      return await this.syncInProgress;
    } finally {
      this.syncInProgress = null;
    }
  }
  async _doSync() {
    const client = await this.ensureClient();
    const spaceId = await this.ensureLearningSpace();
    const rawSkills = await client.learningSpaces.listSkills(spaceId);
    const remoteSkills = rawSkills.map((s) => ({
      id: s.id,
      name: s.name,
      description: s.description,
      diskId: s.disk_id,
      fileIndex: s.file_index ?? [],
      updatedAt: s.updated_at
    }));
    const manifest = await this.readManifest();
    const localMap = /* @__PURE__ */ new Map();
    if (manifest) {
      for (const s of manifest.skills) {
        localMap.set(s.id, s);
      }
    }
    const remoteIds = /* @__PURE__ */ new Set();
    const failedSkillIds = /* @__PURE__ */ new Set();
    const sanitizedNames = /* @__PURE__ */ new Map();
    let downloadCount = 0;
    const collidingSkillIds = /* @__PURE__ */ new Set();
    for (const skill of remoteSkills) {
      let sName;
      try {
        sName = sanitizeSkillName(skill.name);
      } catch {
        this.logger.warn(
          `acontext: skipping skill with unsanitizable name: "${skill.name}" (id: ${skill.id})`
        );
        collidingSkillIds.add(skill.id);
        continue;
      }
      const existing = sanitizedNames.get(sName);
      if (existing) {
        existing.push(skill.id);
      } else {
        sanitizedNames.set(sName, [skill.id]);
      }
    }
    for (const [sName, ids] of sanitizedNames) {
      if (ids.length > 1) {
        this.logger.warn(
          `acontext: sanitized name collision \u2014 ${ids.length} skills collide as "${sName}", skipping all: ${ids.join(", ")}`
        );
        for (const id of ids) collidingSkillIds.add(id);
      }
    }
    for (const skill of remoteSkills) {
      if (collidingSkillIds.has(skill.id)) continue;
      remoteIds.add(skill.id);
      const local = localMap.get(skill.id);
      if (!local || local.updatedAt !== skill.updatedAt) {
        if (local) {
          let oldSanitized = null;
          let newSanitized = null;
          try {
            oldSanitized = sanitizeSkillName(local.name);
          } catch {
          }
          try {
            newSanitized = sanitizeSkillName(skill.name);
          } catch {
          }
          if (oldSanitized && newSanitized && oldSanitized !== newSanitized) {
            const oldDir = this.skillDir(local.name);
            await fs.rm(oldDir, { recursive: true, force: true }).catch(() => {
            });
          }
        }
        const targetDir = this.skillDir(skill.name);
        await fs.rm(targetDir, { recursive: true, force: true }).catch(() => {
        });
        const success = await this.downloadSkillFiles(skill);
        if (!success) {
          failedSkillIds.add(skill.id);
        }
        downloadCount++;
      }
    }
    for (const cid of collidingSkillIds) {
      const local = localMap.get(cid);
      if (local) {
        try {
          const dir = this.skillDir(local.name);
          await fs.rm(dir, { recursive: true, force: true }).catch(() => {
          });
        } catch {
        }
      }
    }
    for (const [id, local] of localMap) {
      if (!remoteIds.has(id) && !collidingSkillIds.has(id)) {
        let dir;
        try {
          dir = this.skillDir(local.name);
        } catch {
          continue;
        }
        await fs.rm(dir, { recursive: true, force: true }).catch((err) => {
          this.logger.warn(
            `acontext: failed to remove deleted skill dir ${dir}: ${String(err)}`
          );
        });
      }
    }
    const nonCollidingSkills = remoteSkills.filter(
      (s) => !collidingSkillIds.has(s.id)
    );
    const manifestSkills = nonCollidingSkills.map((skill) => {
      if (failedSkillIds.has(skill.id)) {
        const local = localMap.get(skill.id);
        return { ...skill, updatedAt: local?.updatedAt ?? "" };
      }
      return skill;
    });
    await this.writeManifest(manifestSkills);
    this.skillsMetadata = nonCollidingSkills;
    this.skillsSynced = true;
    if (downloadCount > 0) {
      this.logger.info(
        `acontext: synced ${downloadCount} skill(s) to ${this.skillsDir} (${nonCollidingSkills.length} total)`
      );
    }
    return nonCollidingSkills;
  }
  // -- Skill querying -------------------------------------------------------
  async listSkills() {
    if (this.skillsMetadata && this.skillsSynced) {
      return this.skillsMetadata;
    }
    try {
      const manifest = await this.readManifest();
      if (manifest && Date.now() - manifest.syncedAt < _AcontextBridge.MANIFEST_STALE_MS) {
        this.skillsMetadata = manifest.skills;
        this.skillsSynced = true;
        return manifest.skills;
      }
      return await this.syncSkillsToLocal();
    } catch (err) {
      this.logger.warn(
        `acontext: listSkills failed, returning cached: ${String(err)}`
      );
      return this.skillsMetadata ?? [];
    }
  }
  async grepSkills(diskId, query, limit = 10) {
    const client = await this.ensureClient();
    try {
      const result = await client.artifacts.grepArtifacts(diskId, {
        query,
        limit
      });
      return (result ?? []).map((a) => ({
        path: a.path,
        filename: a.filename
      }));
    } catch (err) {
      this.logger.warn(
        `acontext: grepSkills failed for disk ${diskId}: ${String(err)}`
      );
      return [];
    }
  }
  async getSkillFileContent(skillId, filePath) {
    const client = await this.ensureClient();
    const resp = await client.skills.getFile({
      skillId,
      filePath,
      expire: 60
    });
    if (resp.content) {
      if (resp.content.type === "base64") {
        return Buffer.from(resp.content.raw, "base64").toString("utf-8");
      }
      return resp.content.raw;
    }
    if (resp.url) {
      const res = await fetch(resp.url);
      if (res.ok) {
        return await res.text();
      }
      throw new Error(`Failed to fetch skill file: ${res.status}`);
    }
    throw new Error("No content available for this skill file");
  }
  // -- Stats ----------------------------------------------------------------
  async getStats() {
    const client = await this.ensureClient();
    try {
      const sessions = await client.sessions.list({
        user: this.cfg.userId,
        filterByConfigs: { source: SOURCE_TAG },
        limit: 100
      });
      const skills = await this.listSkills();
      return {
        sessionCount: sessions.items.length,
        sessionCountIsApproximate: sessions.has_more,
        skillCount: skills.length,
        learningSpaceId: this.learningSpaceId
      };
    } catch (err) {
      this.logger.warn(`acontext: getStats failed: ${String(err)}`);
      return {
        sessionCount: 0,
        sessionCountIsApproximate: false,
        skillCount: 0,
        learningSpaceId: null
      };
    }
  }
  // -- Session history ------------------------------------------------------
  async getRecentSessionSummaries(limit = 3) {
    const client = await this.ensureClient();
    try {
      const sessions = await client.sessions.list({
        user: this.cfg.userId,
        limit,
        timeDesc: true,
        filterByConfigs: { source: SOURCE_TAG }
      });
      if (!sessions.items.length) return "";
      const results = await Promise.all(
        sessions.items.map(async (session) => {
          try {
            const summary = await client.sessions.getSessionSummary(
              session.id,
              { limit: 20 }
            );
            if (summary) {
              return `<session id="${session.id}" created="${session.created_at}">
${summary}
</session>`;
            }
          } catch (err) {
            this.logger.warn(
              `acontext: getSessionSummary failed for ${session.id}: ${String(err)}`
            );
          }
          return null;
        })
      );
      return results.filter(Boolean).join("\n");
    } catch (err) {
      this.logger.warn(
        `acontext: getRecentSessionSummaries failed: ${String(err)}`
      );
      return "";
    }
  }
};

// src/config.ts
var fs2 = __toESM(require("node:fs"));
var os = __toESM(require("node:os"));
var path2 = __toESM(require("node:path"));
function getAcontextConfigDir() {
  return process.env.ACONTEXT_CONFIG_DIR || path2.join(os.homedir(), ".acontext");
}
__name(getAcontextConfigDir, "getAcontextConfigDir");
function loadApiKeyFromCredentials() {
  try {
    const filePath = path2.join(getAcontextConfigDir(), "credentials.json");
    const data = JSON.parse(fs2.readFileSync(filePath, "utf-8"));
    if (data.default_project && data.keys?.[data.default_project]) {
      return data.keys[data.default_project];
    }
  } catch {
  }
  return void 0;
}
__name(loadApiKeyFromCredentials, "loadApiKeyFromCredentials");
function loadUserIdFromAuth() {
  try {
    const filePath = path2.join(getAcontextConfigDir(), "auth.json");
    const data = JSON.parse(fs2.readFileSync(filePath, "utf-8"));
    if (data.user?.email) {
      return data.user.email;
    }
  } catch {
  }
  return void 0;
}
__name(loadUserIdFromAuth, "loadUserIdFromAuth");
function loadConfig() {
  const apiKey = loadApiKeyFromCredentials() || process.env.ACONTEXT_API_KEY?.trim();
  if (!apiKey) {
    throw new Error(
      "ACONTEXT_API_KEY is required. Set it in your shell profile, or run 'acontext login' to configure ~/.acontext/credentials.json."
    );
  }
  const userId = loadUserIdFromAuth() || process.env.ACONTEXT_USER_ID?.trim() || "default";
  return {
    apiKey,
    baseUrl: process.env.ACONTEXT_BASE_URL?.trim() || "https://api.acontext.app/api/v1",
    userId,
    learningSpaceId: process.env.ACONTEXT_LEARNING_SPACE_ID?.trim() || void 0,
    skillsDir: process.env.ACONTEXT_SKILLS_DIR?.trim() || path2.join(os.homedir(), ".claude", "skills"),
    autoCapture: process.env.ACONTEXT_AUTO_CAPTURE !== "false",
    autoLearn: process.env.ACONTEXT_AUTO_LEARN !== "false",
    minTurnsForLearn: (() => {
      const raw = process.env.ACONTEXT_MIN_TURNS_FOR_LEARN || process.env.ACONTEXT_MIN_TURNS || "4";
      const parsed = parseInt(raw, 10);
      return Number.isNaN(parsed) || parsed < 1 ? 4 : parsed;
    })()
  };
}
__name(loadConfig, "loadConfig");
function resolveDataDir() {
  const pluginRoot = process.env.CLAUDE_PLUGIN_ROOT;
  if (pluginRoot) {
    return path2.join(pluginRoot, "data");
  }
  return path2.join(os.homedir(), ".acontext-claude-code");
}
__name(resolveDataDir, "resolveDataDir");

// src/lock.ts
var fs3 = __toESM(require("node:fs/promises"));
var path3 = __toESM(require("node:path"));
var LOCK_STALE_MS = 3e4;
async function acquireLock(lockDir) {
  const MAX_RETRIES = 3;
  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    try {
      await fs3.mkdir(lockDir, { recursive: false });
      await fs3.writeFile(
        path3.join(lockDir, "info"),
        JSON.stringify({ pid: process.pid, ts: Date.now() })
      ).catch(() => {
      });
      return true;
    } catch (err) {
      if (err?.code !== "EEXIST") throw err;
      let reclaimed = false;
      try {
        const raw = await fs3.readFile(path3.join(lockDir, "info"), "utf-8");
        const { ts } = JSON.parse(raw);
        if (Date.now() - ts > LOCK_STALE_MS) {
          await fs3.rm(lockDir, { recursive: true, force: true });
          reclaimed = true;
        }
      } catch {
        try {
          const stat2 = await fs3.stat(lockDir);
          if (Date.now() - stat2.mtimeMs > LOCK_STALE_MS) {
            await fs3.rm(lockDir, { recursive: true, force: true });
            reclaimed = true;
          }
        } catch {
          reclaimed = true;
        }
      }
      if (reclaimed) continue;
      return false;
    }
  }
  return false;
}
__name(acquireLock, "acquireLock");
async function releaseLock(lockDir) {
  await fs3.rm(lockDir, { recursive: true, force: true });
}
__name(releaseLock, "releaseLock");

// src/transcript.ts
var readline = __toESM(require("node:readline/promises"));
var import_node_fs = require("node:fs");
function parseStdinJson(raw, warn) {
  if (!raw.trim()) return null;
  try {
    return JSON.parse(raw);
  } catch {
    warn?.("acontext: failed to parse stdin JSON");
    return null;
  }
}
__name(parseStdinJson, "parseStdinJson");
async function readTranscriptMessages(transcriptPath, warn) {
  const messages = [];
  try {
    const rl = readline.createInterface({
      input: (0, import_node_fs.createReadStream)(transcriptPath, "utf-8"),
      crlfDelay: Infinity
    });
    for await (const line of rl) {
      if (!line.trim()) continue;
      try {
        const obj = JSON.parse(line);
        const msg = obj.message;
        if (msg && msg.role && msg.content !== void 0) {
          const content = msg.content;
          if (Array.isArray(content) && content.length === 0) continue;
          if (typeof content === "string" && content.length === 0) continue;
          messages.push({
            role: msg.role,
            content
          });
        }
      } catch {
        warn?.(`acontext: skipping malformed transcript line: ${line.substring(0, 200)}`);
      }
    }
  } catch (err) {
    if (err?.code !== "ENOENT") {
      warn?.(`acontext: failed to read transcript: ${String(err)}`);
    }
  }
  return messages;
}
__name(readTranscriptMessages, "readTranscriptMessages");
function mergeConsecutiveMessages(raw) {
  const messages = [];
  const rawCounts = [];
  for (const entry of raw) {
    const content = entry.content;
    const blocks = Array.isArray(content) ? content : [{ type: "text", text: content }];
    const prev = messages.length > 0 ? messages[messages.length - 1] : null;
    if (prev && prev.role === entry.role) {
      prev.content.push(...blocks);
      rawCounts[rawCounts.length - 1]++;
    } else {
      messages.push({ role: entry.role, content: [...blocks] });
      rawCounts.push(1);
    }
  }
  return { messages, rawCounts };
}
__name(mergeConsecutiveMessages, "mergeConsecutiveMessages");

// src/hook-handler.ts
var logger = {
  info: /* @__PURE__ */ __name((msg) => console.error(`[info] ${msg}`), "info"),
  warn: /* @__PURE__ */ __name((msg) => console.error(`[warn] ${msg}`), "warn")
};
async function readStdin() {
  const chunks = [];
  for await (const chunk of process.stdin) {
    chunks.push(chunk);
  }
  return Buffer.concat(chunks).toString("utf-8");
}
__name(readStdin, "readStdin");
async function handleSessionStart(bridge) {
  await bridge.clearSessionState();
  const sessionId = await bridge.ensureSession();
  await bridge.saveSessionState();
  logger.info(`acontext: session started: ${sessionId}`);
  bridge.syncSkillsToLocal().catch((err) => {
    logger.warn(`acontext: skill sync on session-start failed: ${String(err)}`);
  });
}
__name(handleSessionStart, "handleSessionStart");
async function handlePostToolUse(bridge, config, lockDir) {
  const raw = await readStdin();
  const data = parseStdinJson(raw, logger.warn);
  const locked = await acquireLock(lockDir);
  if (!locked) {
    logger.info("acontext: another hook process is active, skipping capture");
    return;
  }
  try {
    let sessionId = bridge.getSessionId();
    if (!sessionId) {
      const restored = await bridge.loadSessionState();
      if (!restored) {
        await bridge.ensureSession();
        await bridge.saveSessionState();
      }
      sessionId = bridge.getSessionId();
    }
    if (!sessionId) return;
    const transcriptPath = data?.transcript_path;
    if (!transcriptPath) {
      logger.warn(
        "acontext: no transcript_path in hook data, skipping capture"
      );
      return;
    }
    const allRawMessages = await readTranscriptMessages(transcriptPath, logger.warn);
    if (allRawMessages.length === 0) return;
    const lastIdx = bridge.getLastProcessedIndex();
    const newRaw = allRawMessages.slice(lastIdx);
    if (newRaw.length === 0) return;
    const { messages: merged, rawCounts } = mergeConsecutiveMessages(newRaw);
    const { stored, processed } = await bridge.storeMessages(
      sessionId,
      merged,
      lastIdx
    );
    if (processed > 0) {
      const rawProcessed = rawCounts.slice(0, processed).reduce((a, b) => a + b, 0);
      bridge.setLastProcessedIndex(lastIdx + rawProcessed);
    }
    if (stored > 0) {
      bridge.incrementTurnCount();
      logger.info(
        `acontext: captured ${stored} new messages (${newRaw.length} raw blocks merged to ${merged.length}), ${allRawMessages.length} total in transcript (turn ${bridge.getTurnCount()})`
      );
    }
    if (processed > 0) {
      await bridge.saveSessionState();
    }
    if (config.autoLearn && bridge.getTurnCount() >= config.minTurnsForLearn) {
      try {
        await bridge.flush(sessionId);
        const result = await bridge.learnFromSession(sessionId);
        if (result.status === "learned") {
          logger.info(
            `acontext: auto-learn triggered (learning: ${result.id})`
          );
          bridge.resetTurnCount();
          await bridge.saveSessionState();
        }
      } catch (err) {
        logger.warn(`acontext: auto-learn failed: ${String(err)}`);
      }
    }
  } finally {
    await releaseLock(lockDir);
  }
}
__name(handlePostToolUse, "handlePostToolUse");
async function handleStop(bridge, config, lockDir) {
  const raw = await readStdin();
  const data = parseStdinJson(raw, logger.warn);
  if (!bridge.getSessionId()) {
    await bridge.loadSessionState();
  }
  const sessionId = bridge.getSessionId();
  if (!sessionId) return;
  let locked = false;
  for (let attempt = 0; attempt < 10; attempt++) {
    locked = await acquireLock(lockDir);
    if (locked) break;
    await new Promise((r) => setTimeout(r, 500));
  }
  try {
    await new Promise((r) => setTimeout(r, 1e3));
    if (locked) {
      await bridge.loadSessionState();
    }
    const transcriptPath = data?.transcript_path;
    if (transcriptPath) {
      const allRawMessages = await readTranscriptMessages(transcriptPath, logger.warn);
      if (allRawMessages.length > 0) {
        const lastIdx = bridge.getLastProcessedIndex();
        const newRaw = allRawMessages.slice(lastIdx);
        if (newRaw.length > 0) {
          const { messages: merged, rawCounts } = mergeConsecutiveMessages(newRaw);
          const { stored, processed } = await bridge.storeMessages(
            sessionId,
            merged,
            lastIdx
          );
          if (processed > 0) {
            const rawProcessed = rawCounts.slice(0, processed).reduce((a, b) => a + b, 0);
            bridge.setLastProcessedIndex(lastIdx + rawProcessed);
          }
          if (stored > 0) {
            logger.info(`acontext: final capture: ${stored} new messages`);
          }
          if (processed > 0) {
            await bridge.saveSessionState();
          }
        }
      }
    }
    try {
      await bridge.flush(sessionId);
      logger.info(`acontext: session flushed: ${sessionId}`);
    } catch (err) {
      logger.warn(`acontext: flush failed: ${String(err)}`);
    }
    if (config.autoLearn) {
      try {
        const result = await bridge.learnFromSession(sessionId);
        if (result.status === "learned") {
          logger.info(
            `acontext: end-of-session learn triggered (learning: ${result.id})`
          );
          bridge.syncSkillsToLocal().catch((err) => {
            logger.warn(
              `acontext: skill sync after learning failed: ${String(err)}`
            );
          });
        }
      } catch (err) {
        logger.warn(`acontext: end-of-session learn failed: ${String(err)}`);
      }
    }
  } finally {
    if (locked) {
      await releaseLock(lockDir);
    }
  }
}
__name(handleStop, "handleStop");
async function handleNotification(bridge, lockDir) {
  const raw = await readStdin();
  const data = parseStdinJson(raw, logger.warn);
  const locked = await acquireLock(lockDir);
  if (!locked) {
    logger.info("acontext: notification: another hook process is active, skipping");
    return;
  }
  try {
    let sessionId = bridge.getSessionId();
    if (!sessionId) {
      const restored = await bridge.loadSessionState();
      if (!restored) return;
      sessionId = bridge.getSessionId();
    }
    if (!sessionId) return;
    const transcriptPath = data?.transcript_path;
    if (!transcriptPath) return;
    const allRawMessages = await readTranscriptMessages(transcriptPath, logger.warn);
    if (allRawMessages.length === 0) return;
    const lastIdx = bridge.getLastProcessedIndex();
    const newRaw = allRawMessages.slice(lastIdx);
    if (newRaw.length === 0) return;
    const { messages: merged, rawCounts } = mergeConsecutiveMessages(newRaw);
    const { stored, processed } = await bridge.storeMessages(
      sessionId,
      merged,
      lastIdx
    );
    if (processed > 0) {
      const rawProcessed = rawCounts.slice(0, processed).reduce((a, b) => a + b, 0);
      bridge.setLastProcessedIndex(lastIdx + rawProcessed);
    }
    if (stored > 0) {
      logger.info(`acontext: notification: captured ${stored} supplementary messages`);
    }
    if (processed > 0) {
      await bridge.saveSessionState();
    }
  } finally {
    await releaseLock(lockDir);
  }
}
__name(handleNotification, "handleNotification");
async function main() {
  const command = process.argv[2];
  if (!command) {
    console.error("Usage: hook-handler.cjs <session-start|post-tool-use|stop|notification>");
    process.exit(1);
  }
  let config;
  try {
    config = loadConfig();
  } catch (err) {
    logger.info(`acontext: config unavailable (${String(err)}), skipping hook`);
    return;
  }
  if (!config.autoCapture) {
    logger.info("acontext: auto-capture disabled, skipping hook");
    return;
  }
  const dataDir = resolveDataDir();
  const bridge = new AcontextBridge(config, dataDir, logger);
  const lockDir = path4.join(dataDir, ".hook-lock");
  switch (command) {
    case "session-start":
      await handleSessionStart(bridge);
      break;
    case "post-tool-use":
      await handlePostToolUse(bridge, config, lockDir);
      break;
    case "stop":
      await handleStop(bridge, config, lockDir);
      break;
    case "notification":
      await handleNotification(bridge, lockDir);
      break;
    default:
      console.error(`Unknown command: ${command}`);
      process.exit(1);
  }
}
__name(main, "main");
main().catch((err) => {
  console.error(`[acontext] Hook error: ${err}`);
  process.exit(1);
});
