var browserify = require('browserify'),
    gulp = require('gulp'),
    source = require('vinyl-source-stream'),
    reactify = require('reactify'),
    less = require('gulp-less'),
    autoprefixer = require('gulp-autoprefixer'),
    minifycss = require('gulp-minify-css'),
    rename = require('gulp-rename'),
    imagemin = require('gulp-imagemin'),
    del = require('del'),
    fs = require('fs'),
    replace = require('gulp-replace'),
    inject = require('gulp-inject')
    ;

var watching = false;
var handleError = function(err){
  console.error(err.toString());
  if(watching){
    return this.emit('end');
  }
  return process.exit(1);
}

gulp.task('clean', function(cb) {
  del([
      'web/site/**'
    ], cb);
});

gulp.task('styles', function() {
  return gulp.src('web/src/style/main.less')
    .pipe(less().on('error', handleError))
    .pipe(autoprefixer('last 2 version', 'safari 5', 'ie 8', 'ie 9', 'opera 12.1', 'ios 6', 'android 4').on('error', handleError))
    .pipe(rename({basename: 'style'}).on('error', handleError))
    .pipe(gulp.dest('web/site/style'))
    .pipe(rename({suffix: '.min'}).on('error', handleError))
    .pipe(minifycss().on('error', handleError))
    .pipe(gulp.dest('web/site/style'))
    ;
});

var reactifyES6 = function(file){
  return reactify(file, {es6: true});
};

gulp.task('scripts', function(){
  var b = browserify();
  b.transform(reactifyES6); // use the reactify transform
  b.add('./web/src/js/app.js');
  return b.bundle()
    .on('error', handleError)
    .pipe(source('app.js'))
    .pipe(gulp.dest('web/site/js'));
});

gulp.task('html', function(){
  return gulp.src('web/src/*.html')
  .pipe(inject(gulp.src(['web/src/partials/*.html']), {
    starttag: '<!-- inject:partials -->',
    transform: function (filePath, file) {
      // return file contents as string
      return file.contents.toString('utf8');
    }
  }).on('error', handleError))
  .pipe(replace(/<!--.+?-->/gm, '').on('error', handleError))
  .pipe(gulp.dest('web/site'))
  ;
});

gulp.task('images', function() {
  return gulp.src('web/src/images/**/*')
    .pipe(imagemin({
      progressive: true,
      interlaced: true,
      svgoPlugins: [{removeViewBox: false}]
    }).on('error', handleError))
    .pipe(gulp.dest('web/site/images'))
    ;
});

gulp.task('watch', ['clean'], function() {
  watching = true;
  // Watch .less files
  gulp.watch('web/src/style/**/*.less', ['styles']);
  // Watch .css files
  gulp.watch('web/src/style/**/*.css', ['styles']);
  // Watch .js files
  gulp.watch('web/src/**/*.js', ['scripts']);
  gulp.watch('web/src/**/*.jsx', ['scripts']);
  // Watch image files
  gulp.watch('web/src/images/**/*', ['images']);
  // Watch the html files
  gulp.watch('web/src/**/*.html', ['html']);
  gulp.watch('web/src/**/*.md', ['html']);
  // Start
  gulp.start('styles', 'html', 'images', 'scripts');
});

gulp.task('default', ['clean'], function() {
    gulp.start('styles', 'html', 'images', 'scripts');
});
