module.exports = function (eleventyConfig) {
  // Passthrough copy — static assets from repo root to output
  eleventyConfig.addPassthroughCopy({ "css": "css" });
  eleventyConfig.addPassthroughCopy({ "js": "js" });
  eleventyConfig.addPassthroughCopy({ "images": "images" });
  eleventyConfig.addPassthroughCopy({ "assets": "assets" });

  // Article lead images live alongside the source markdown under
  // src/articles/<issue>/, and mirror into _site/articles/<issue>/.
  eleventyConfig.addPassthroughCopy({ "src/articles/**/*.jpeg": "articles" });
  eleventyConfig.addPassthroughCopy({ "src/articles/**/*.jpg": "articles" });
  eleventyConfig.addPassthroughCopy({ "src/articles/**/*.png": "articles" });
  eleventyConfig.addPassthroughCopy({ "src/articles/**/*.svg": "articles" });

  // Collection: articles sorted by order field
  eleventyConfig.addCollection("articles", function (collectionApi) {
    return collectionApi
      .getFilteredByGlob("src/articles/**/*.md")
      .sort(function (a, b) {
        return (a.data.order || 999) - (b.data.order || 999);
      });
  });

  // Extract the first N rendered paragraphs from a templateContent string.
  // Used on the front page to show a lede excerpt of the featured article.
  eleventyConfig.addFilter("firstParagraphs", function (html, n) {
    if (!html) return "";
    n = n || 2;
    var matches = html.match(/<p[\s\S]*?<\/p>/g);
    if (!matches) return "";
    return matches.slice(0, n).join("\n");
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
