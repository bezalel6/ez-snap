// opencv.d.ts

declare global {
    interface Window {
        cv: OpenCVNamespace;
    }
}

// OpenCV Mat class
declare class Mat {
    rows: number;
    cols: number;
    data: Uint8Array;
    data32F: Float32Array;
    data64F: Float64Array;
    constructor();
    constructor(rows: number, cols: number, type: number);
    constructor(rows: number, cols: number, type: number, scalar: Scalar);
    constructor(data: number[][], type: number);
    delete(): void;
    static zeros(rows: number, cols: number, type: number): Mat;
    static ones(rows: number, cols: number, type: number): Mat;
    static eye(rows: number, cols: number, type: number): Mat;
}

// OpenCV Point classes
declare class Point {
    x: number;
    y: number;
    constructor(x?: number, y?: number);
}

declare class Point2f {
    x: number;
    y: number;
    constructor(x?: number, y?: number);
}

declare class Point3f {
    x: number;
    y: number;
    z: number;
    constructor(x?: number, y?: number, z?: number);
}

// OpenCV Size classes
declare class Size {
    width: number;
    height: number;
    constructor(width?: number, height?: number);
}

declare class Size2f {
    width: number;
    height: number;
    constructor(width?: number, height?: number);
}

// OpenCV Rect classes
declare class Rect {
    x: number;
    y: number;
    width: number;
    height: number;
    constructor(x?: number, y?: number, width?: number, height?: number);
}

declare class Rect2f {
    x: number;
    y: number;
    width: number;
    height: number;
    constructor(x?: number, y?: number, width?: number, height?: number);
}

// OpenCV Scalar
declare class Scalar {
    constructor(v0?: number, v1?: number, v2?: number, v3?: number);
}

// OpenCV Range
declare class Range {
    start: number;
    end: number;
    constructor(start?: number, end?: number);
}

// OpenCV RotatedRect
declare class RotatedRect {
    center: Point2f;
    size: Size2f;
    angle: number;
    constructor(center?: Point2f, size?: Size2f, angle?: number);
}

// Vector Types
declare class MatVector {
    constructor();
    size(): number;
    get(index: number): Mat;
    push_back(mat: Mat): void;
    delete(): void;
}

declare class PointVector {
    constructor();
    size(): number;
    get(index: number): Point;
    push_back(point: Point): void;
    delete(): void;
}

declare class IntVector {
    constructor();
    size(): number;
    get(index: number): number;
    push_back(value: number): void;
    delete(): void;
}

declare class FloatVector {
    constructor();
    size(): number;
    get(index: number): number;
    push_back(value: number): void;
    delete(): void;
}

declare class DoubleVector {
    constructor();
    size(): number;
    get(index: number): number;
    push_back(value: number): void;
    delete(): void;
}

declare class RectVector {
    constructor();
    size(): number;
    get(index: number): Rect;
    push_back(rect: Rect): void;
    delete(): void;
}

// ArUco related classes
declare class ArUcoBoard {
    constructor();
    delete(): void;
}

declare class ArUcoDetectorParameters {
    constructor();
    delete(): void;
}

declare class ArUcoDictionary {
    constructor();
    delete(): void;
}

interface OpenCVNamespace {
    onRuntimeInitialized: () => void;

    // Core Classes
    Mat: typeof Mat;
    Point: typeof Point;
    Point2f: typeof Point2f;
    Point3f: typeof Point3f;
    Size: typeof Size;
    Size2f: typeof Size2f;
    Rect: typeof Rect;
    Rect2f: typeof Rect2f;
    Scalar: typeof Scalar;
    Range: typeof Range;
    RotatedRect: typeof RotatedRect;

    // Vector Types
    MatVector: typeof MatVector;
    PointVector: typeof PointVector;
    IntVector: typeof IntVector;
    FloatVector: typeof FloatVector;
    DoubleVector: typeof DoubleVector;
    RectVector: typeof RectVector;

    // ArUco namespace
    aruco: {
        getPredefinedDictionary: new (dict: number) => ArUcoDictionary;
        detectMarkers: (
            image: Mat,
            dictionary: ArUcoDictionary,
            corners: MatVector,
            ids: Mat,
            parameters: ArUcoDetectorParameters,
            rejected: MatVector
        ) => void;
        estimatePoseBoard: (
            corners: MatVector,
            ids: Mat,
            board: ArUcoBoard,
            dictionary: ArUcoDictionary,
            cameraMatrix: Mat,
            distCoeffs: Mat,
            rvec: Mat,
            tvec: Mat
        ) => void;
        Board: typeof ArUcoBoard;
        DetectorParameters: typeof ArUcoDetectorParameters;
        DICT_4X4_50: number;
    };

    // Key Functions by Category
    matFromImageData: (imageData: ImageData) => Mat;
    matFromArray: (rows: number, cols: number, type: number, data: number[]) => Mat;
    matMul: (a: Mat, b: Mat) => Mat;

    imread: (filename: string, flags?: number) => Mat;
    imshow: (name: string, mat: Mat) => void;
    imwrite: (filename: string, img: Mat, params?: unknown[]) => boolean;

    cvtColor: (src: Mat, dst: Mat, code: number, dstCn?: number) => void;
    GaussianBlur: (src: Mat, dst: Mat, ksize: Size, sigmaX: number, sigmaY?: number, borderType?: number) => void;
    medianBlur: (src: Mat, dst: Mat, ksize: number) => void;
    bilateralFilter: (src: Mat, dst: Mat, d: number, sigmaColor: number, sigmaSpace: number, borderType?: number) => void;

    filter2D: (src: Mat, dst: Mat, ddepth: number, kernel: Mat, anchor?: Point, delta?: number, borderType?: number) => void;
    sepFilter2D: (src: Mat, dst: Mat, ddepth: number, kernelX: Mat, kernelY: Mat, anchor?: Point, delta?: number, borderType?: number) => void;

    Sobel: (src: Mat, dst: Mat, ddepth: number, dx: number, dy: number, ksize?: number, scale?: number, delta?: number, borderType?: number) => void;
    Scharr: (src: Mat, dst: Mat, ddepth: number, dx: number, dy: number, scale?: number, delta?: number, borderType?: number) => void;
    Laplacian: (src: Mat, dst: Mat, ddepth: number, ksize?: number, scale?: number, delta?: number, borderType?: number) => void;

    erode: (src: Mat, dst: Mat, kernel: Mat, anchor?: Point, iterations?: number, borderType?: number, anchorPoint?: Point) => void;
    dilate: (src: Mat, dst: Mat, kernel: Mat, anchor?: Point, iterations?: number, borderType?: number, anchorPoint?: Point) => void;
    morphologyEx: (src: Mat, dst: Mat, op: number, kernel: Mat, anchor?: Point, iterations?: number, borderType?: number, anchorPoint?: Point) => void;

    getStructuringElement: (shape: number, ksize: Size, anchor?: Point) => Mat;

    Canny: (src: Mat, edges: Mat, threshold1: number, threshold2: number, apertureSize?: number, L2gradient?: boolean) => void;
    cornerHarris: (image: Mat, dst: Mat, blockSize: number, ksize: number, k: number, borderType?: number) => void;
    goodFeaturesToTrack: (image: Mat, maxCorners: number, qualityLevel: number, minDistance: number, mask?: Mat, blockSize?: number, useHarrisDetector?: boolean, k?: number) => PointVector;

    HoughLines: (image: Mat, lines: PointVector, rho: number, theta: number, threshold: number, srn?: number, stheta?: number) => void;
    HoughLinesP: (image: Mat, lines: PointVector, rho: number, theta: number, threshold: number, minLineLength?: number, maxLineGap?: number) => void;
    HoughCircles: (image: Mat, circles: PointVector, method: number, dp: number, minDist: number, param1?: number, param2?: number, minRadius?: number, maxRadius?: number) => void;

    findContours: (image: Mat, contours: MatVector, hierarchy: Mat, mode: number, method: number, offset?: Point) => void;
    drawContours: (img: Mat, contours: MatVector, contourIdx: number, color: Scalar, thickness?: number, lineType?: number, hierarchy?: Mat, maxLevel?: number, offset?: Point) => void;

    contourArea: (contour: Mat, oriented?: boolean) => number;
    arcLength: (curve: Mat, closed: boolean) => number;
    approxPolyDP: (curve: Mat, epsilon: number, closed: boolean) => Mat;

    line: (img: Mat, pt1: Point, pt2: Point, color: Scalar, thickness?: number, lineType?: number, shift?: number) => void;
    rectangle: (img: Mat, pt1: Point, pt2: Point, color: Scalar, thickness?: number, lineType?: number, shift?: number) => void;
    circle: (img: Mat, center: Point, radius: number, color: Scalar, thickness?: number, lineType?: number, shift?: number) => void;
    ellipse: (img: Mat, center: Point, axes: Size, angle: number, startAngle: number, endAngle: number, color: Scalar, thickness?: number, lineType?: number, shift?: number) => void;
    polylines: (img: Mat, pts: PointVector, isClosed: boolean, color: Scalar, thickness?: number, lineType?: number, shift?: number) => void;

    putText: (img: Mat, text: string, org: Point, fontFace: number, fontScale: number, color: Scalar, thickness?: number, lineType?: number, bottomLeftOrigin?: boolean) => void;
    getTextSize: (text: string, fontFace: number, fontScale: number, thickness: number, baseLine?: number) => Size;

    resize: (src: Mat, dst: Mat, dsize: Size, fx?: number, fy?: number, interpolation?: number) => void;
    warpAffine: (src: Mat, dst: Mat, M: Mat, dsize: Size, flags?: number, borderMode?: number, borderValue?: Scalar) => void;
    warpPerspective: (src: Mat, dst: Mat, M: Mat, dsize: Size, flags?: number, borderMode?: number, borderValue?: Scalar) => void;

    getRotationMatrix2D: (center: Point, angle: number, scale: number) => Mat;
    getAffineTransform: (srcPoints: PointVector, dstPoints: PointVector) => Mat;
    getPerspectiveTransform: (srcPoints: PointVector, dstPoints: PointVector) => Mat;

    // Rodrigues and other functions
    Rodrigues: (src: Mat, dst: Mat) => void;
    transpose: (src: Mat, dst: Mat) => void;
    undistortPoints: (src: Mat, dst: Mat, cameraMatrix: Mat, distCoeffs: Mat) => void;

    // Utility functions
    getBuildInformation: () => string;

    // Constants and Enums
    COLOR_BGR2GRAY: number;
    COLOR_RGB2HSV: number;
    COLOR_RGBA2GRAY: number;
    BORDER_DEFAULT: number;
    MORPH_RECT: number;
    RETR_EXTERNAL: number;
    CHAIN_APPROX_SIMPLE: number;
    INTER_LINEAR: number;
    CV_64F: number;
    CV_32FC2: number;
}

declare module '@techstark/opencv-js' {
    const cvReadyPromise: Promise<OpenCVNamespace>;
    export = cvReadyPromise;
}
