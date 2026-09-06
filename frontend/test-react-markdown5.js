import React from 'react';
import { renderToString } from 'react-dom/server';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

const text = "- [ ] test\n- [x] test2";

const App = () => {
  return React.createElement(ReactMarkdown, {
    remarkPlugins: [remarkGfm],
    components: {
      li: (props) => {
        console.log('LI PROPS:', Object.keys(props), 'checked:', props.checked);
        return React.createElement('li', null, props.children);
      }
    }
  }, text);
};
renderToString(React.createElement(App));
