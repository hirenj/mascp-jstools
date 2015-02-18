module.exports = function(grunt) {

  // Project configuration.
  grunt.initConfig({
    pkg: grunt.file.readJSON('package.json'),
    uglify: {
      build: {
        files: {
          'build/<%= pkg.name %>.services.min.js' : ['build/<%= pkg.name %>.services.js'],
          'build/<%= pkg.name %>.map.min.js' : ['build/<%= pkg.name %>.map.js'],
          'build/<%= pkg.name %>.renderers.min.js' : ['build/<%= pkg.name %>.renderers.js'],
          'build/<%= pkg.name %>.min.js' : ['build/<%= pkg.name %>.js']
         }
      }
    },
    copy: {
      dist: {
        expand: true,
        cwd: 'build/',
        src: '**',
        dest: 'dist/js/',
        flatten: true,
        filter: 'isFile'
      }
    },
    concat: {
      basic: {
        files : {
          'build/<%= pkg.name %>.services.js' : ['js/lib/MascpService.js','js/lib/*Reader.js','js/lib/*Runner.js','js/lib/MascotToJSON.js', 'js/lib/gator-reader-element.js' ],
          'build/<%= pkg.name %>.map.js' : [ 'js/lib/gomap.js'],
          'build/<%= pkg.name %>.renderers.js' : [ 'js/hammer.js','js/jsandbox.js','js/piemenu.js','js/lib/SequenceRenderer.js','js/lib/SVGCanvas.js','js/lib/CondensedSequenceRenderer.js','js/lib/CondensedSequenceRendererNavigation.js','js/lib/TagVisualisation.js','js/lib/gator-element.js' ],
          'build/<%= pkg.name %>.js' : [ 'js/bean.js','js/observe.js','build/<%= pkg.name %>.services.js','build/<%= pkg.name %>.renderers.js','build/<%= pkg.name %>.map.js' ]
        }
      }
    }
  });
  grunt.loadNpmTasks('grunt-contrib-concat');
  grunt.loadNpmTasks('grunt-contrib-uglify');
  grunt.loadNpmTasks('grunt-contrib-copy');

  // Default task(s).
  grunt.registerTask('default', ['concat','copy','uglify']);

};
