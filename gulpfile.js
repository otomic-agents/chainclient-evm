// eslint-disable-next-line @typescript-eslint/no-var-requires
const gulp = require("gulp");
// eslint-disable-next-line @typescript-eslint/no-var-requires
const ts = require("gulp-typescript");
const sourcemaps = require("gulp-sourcemaps");

function copyJs() {
  return gulp.src("src/**/*.js").pipe(gulp.dest("dist"));
}

function copyJson() {
  return gulp.src("src/**/*.json").pipe(gulp.dest("dist"));
}

function copyConfig() {
  return gulp
    .src("src/config/**/*.json", { base: "src" })
    .pipe(gulp.dest("dist"));
}

function buildTs() {
  return gulp
    .src("src/**/*.ts")
    .pipe(sourcemaps.init())
    .pipe(
      ts({
        target: "ES6",
        lib: ["es2019"],
        noImplicitAny: false,
        downlevelIteration: true,
        module: "commonjs",
        skipLibCheck: true,
        sourceMap: true,
        experimentalDecorators: true,
        esModuleInterop: true,
      })
    )
    .pipe(
      sourcemaps.write("../map", {
        includeContent: true,
        sourceRoot: process.cwd() + "/src",
      })
    )
    .pipe(gulp.dest("dist"));
}

gulp.task(
  "default",
  gulp.series(copyJs, copyJson, copyConfig, buildTs),
  function () {
    console.log("task complete");
  }
);
