Markdown is a lightweight markup language that's easy to write and read. It's often used for formatting readme files, writing messages in online forums, and creating rich text using a plain text editor. Below, I'll guide you through the basic syntax of Markdown and show you how to incorporate code snippets from JavaScript, SQL, and Bash scripts effectively.

### Basic Markdown Syntax

#### Headers
Headers are created by using the `#` symbol before your text. The number of `#` symbols you use will determine the size of the header.

```markdown
# Header 1
## Header 2
### Header 3
#### Header 4
##### Header 5
###### Header 6
```

#### Emphasis
You can make text italic or bold.

```markdown
*This text will be italic*
_This will also be italic_

**This text will be bold**
__This will also be bold__

*You **can** combine them*
```

#### Lists
Markdown supports ordered (numbered) and unordered (bulleted) lists.

```markdown
Unordered
* Item 1
* Item 2
  * Item 2a
  * Item 2b

Ordered
1. Item 1
2. Item 2
3. Item 3
   1. Item 3a
   2. Item 3b
```

#### Links and Images
To create a link, wrap the link text in brackets `[]` and then follow it immediately with the URL in parentheses `()`.

```markdown
[GitHub](http://github.com)
```

Images are almost identical to links but they have a preceding exclamation mark `!`.

```markdown
![GitHub Logo](/images/logo.png)
```

#### Blockquotes
To create a blockquote, start a line with `>`.

```markdown
> This is a blockquote with two paragraphs. Lorem ipsum dolor sit amet,
> consectetuer adipiscing elit. Aliquam hendrerit mi posuere lectus.
>
> Vestibulum enim wisi, viverra nec, fringilla in, laoreet vitae, risus.
```

### Adding Code

To add code into a Markdown document, you can use inline code or code blocks.

#### Inline Code
Use single backticks to enclose your code. This is useful for mentioning code within a paragraph.

```markdown
Here is some inline code: `var example = true;`
```

#### Code Blocks
For longer snippets of code, you can use triple backticks ``` or indent with four spaces.

```markdown
```javascript
// JavaScript code
function greet() {
    console.log("Hello, world!");
}
```

```sql
-- SQL syntax
SELECT * FROM Users WHERE isActive = 1;
```

```bash
# Bash script
echo "Hello, world!"
ls -l /usr/
```
```

### Advanced Features

#### Tables
You can create tables by using pipes `|` and dashes `-`. The pipes define the columns, while the dashes are used to separate the header from the body.

```markdown
| Syntax      | Description |
| ----------- | ----------- |
| Header      | Title       |
| Paragraph   | Text        |

Use `:` to align text:
| Syntax      | Description | Test Scores |
| :---        |    :----:   |      ---: |
| Header      | Title       |         20 |
| Paragraph   | Text        |        400 |
```

#### Syntax Highlighting
Some Markdown renderers support syntax highlighting. By specifying the language next to the triple backticks, you can enable this feature.

Markdown is a versatile tool that can enhance the readability of your text files, especially when you combine textual content with programming code. It's widely supported by many platforms (like GitHub and Stack Overflow) and helps in documenting software projects effectively.