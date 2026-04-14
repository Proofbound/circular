module.exports = function (eleventyConfig) {
  // Passthrough copy — static assets from repo root to output
  eleventyConfig.addPassthroughCopy({ "css": "css" });
  eleventyConfig.addPassthroughCopy({ "js": "js" });
  eleventyConfig.addPassthroughCopy({ "images": "images" });
  eleventyConfig.addPassthroughCopy({ "assets": "assets" });
  // Masthead images live in assets/ (passthrough copied above)

  // Article-level images (served from articles/ in output)
  eleventyConfig.addPassthroughCopy({ "articles/**/*.jpeg": "articles/" });
  eleventyConfig.addPassthroughCopy({ "articles/**/*.jpg": "articles/" });
  eleventyConfig.addPassthroughCopy({ "articles/**/*.png": "articles/" });

  // Collection: articles sorted by order field
  eleventyConfig.addCollection("articles", function (collectionApi) {
    return collectionApi
      .getFilteredByGlob("src/articles/**/*.md")
      .sort(function (a, b) {
        return (a.data.order || 999) - (b.data.order || 999);
      });
  });

  // Nunjucks filter: selectattr (for filtering collections by data field)
  eleventyConfig.addFilter("selectattr", function (arr, attr, value) {
    if (arguments.length === 2) {
      return (arr || []).filter(function (item) {
        var keys = attr.split(".");
        var val = item;
        for (var i = 0; i < keys.length; i++) val = val ? val[keys[i]] : undefined;
        return !!val;
      });
    }
    var cmp = arguments.length === 4 ? arguments[3] : value;
    return (arr || []).filter(function (item) {
      var keys = attr.split(".");
      var val = item;
      for (var i = 0; i < keys.length; i++) val = val ? val[keys[i]] : undefined;
      return val === cmp;
    });
  });

  return {
    dir: {
      input: "src",
      includes: "_includes",
      data: "_data",
      output: "_site",
    },
    templateFormats: ["njk", "md", "html"],
    htmlTemplateEngine: "njk",
    markdownTemplateEngine: "njk",
  };
};
