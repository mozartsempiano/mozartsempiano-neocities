---
title: Sitemap
layout: default
css: sitemap.css
---

<ol>
{% for page in collections.allPages | sort(attribute="url") %}
  <li>
    <a href="{{ page.url }}">{{ page.url }}</a>
    <sub class="lastModif" title="Última modificação">{{ page.date | date: "%d.%m.%Y" }}</sub>
  </li>
{% endfor %}
</ol>
