---
title: Sitemap
layout: default
css: sitemap.css
---

{% macro renderTree(nodes) %}

<ul>
{% for node in nodes %}
  <li>
    {% if node.page %}
      <a href="{{ node.page.url }}">{{ node.page.url }}</a>
    {% else %}
      {{ node.label }}
    {% endif %}
    {% if node.children | length %}
      {{ renderTree(node.children) }}
    {% endif %}
  </li>
{% endfor %}
</ul>
{% endmacro %}

{{ renderTree(collections.allPages | pagesTree) }}
