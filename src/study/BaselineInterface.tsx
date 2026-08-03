import { Button, Textarea } from "@nextui-org/react";
import React, { useEffect, useMemo, useState } from "react";
import { FaTrashCan } from "react-icons/fa6";
import { IoSend } from "react-icons/io5";
import { PiOpenAiLogo } from "react-icons/pi";
import ReactMarkdown from 'react-markdown';
import { Transforms, createEditor } from "slate";
import { withHistory } from "slate-history";
import { Editable, Slate, withReact } from "slate-react";
import { openai, useModelStore } from "../model/Model";
import { useStudyStore } from "./StudyModel";

export interface MessageGPT {
  role: "user" | "assistant" | "system",
  content: string
}

export default function BaselineInterface(props: { children?: React.ReactNode }) {
  const [textInputValue, setTextInputValue] = useState("");
  const [gptMessages, setGptMessages] = useState<MessageGPT[]>([
  ]);
  const messageDivRef = React.createRef<HTMLDivElement>();
  const textState = useModelStore(state => state.textState);

  const editor = useMemo(() => {
    const instance = withReact(withHistory(createEditor()))

    const { normalizeNode } = instance

    instance.normalizeNode = entry => {
      const [node, path] = entry

      if (path.length === 0) { // Root node
        const paragraphs = (node as any).children;
        // Ensure that there is only one paragraph
        if (paragraphs.length > 1) {

          // Add a new line at the begining of the following paragraph
          Transforms.insertText(instance, "\n", { at: { path: [1, 0], offset: 0 } })
          Transforms.mergeNodes(instance, { at: [1] })
        }
      }

      // Fall back to the original `normalizeNode` to enforce other constraints.
      normalizeNode(entry)
    }
    return instance;
  }, []);

  const onMessageSend = () => {
    const messages: MessageGPT[] = [...gptMessages, { content: textInputValue, role: 'user' }];
    setGptMessages(messages);
    setTextInputValue("");

    useStudyStore.getState().logEvent("CHATGPT_PROMPTED", { prompt: textInputValue });

    // Send the message to ChatGPT
    (async () => {
      const stream = await openai.chat.completions.create({
        model: 'gpt-4o',
        messages: messages,
        stream: true,
      });

      const response: MessageGPT = { content: "", role: 'assistant' };

      setGptMessages([...messages, response]);
      for await (const chunk of stream) {
        response.content += chunk.choices[0]?.delta?.content || '';
        setGptMessages([...messages, response]);
      }

      useStudyStore.getState().logEvent("CHATGPT_RESPONDED", { response: response.content, fullHistory: gptMessages });

    })();
  }

  useEffect(() => {
    if (messageDivRef.current) {
      // Always scroll to the bottom of the message
      messageDivRef.current.scrollTop = messageDivRef.current.scrollHeight;
    }
  });


  useEffect(() => {
    editor.children = textState;
    editor.onChange();
  }, [editor, textState]);


  return (
    <>
      <div style={{ display: 'flex', flexDirection: 'row', height: '100vh', width: '100%', background: '#F2EEF0' }}>
        {/* Text Editor Side */}
        <div style={{ minWidth: 720, height: '100%', width: '70%', display: 'flex', flexDirection: 'row', justifyContent: 'center' }}>
          <div id="mainTextField" className={"textEditor"} style={{ position: 'relative', background: 'white', width: 700, paddingTop: 60, marginTop: 20, paddingLeft: 50, paddingRight: 50, borderRadius: '2px', boxShadow: '0 0 10px rgba(0,0,0,0.1)', overflow: 'scroll' }}>
            <Slate editor={editor} initialValue={[]}>
              <Editable />
            </Slate>
          </div>
        </div>
        {/* ChatGPT Side */}
        <div style={{ position: 'relative', width: '30%', background: 'white', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
          <Button variant="light" isIconOnly disabled={gptMessages.length === 0} style={{top: 5, right: 5, fontSize: 16, position: 'absolute'}} size="sm" 
            onClick={() => setGptMessages([])}
          ><FaTrashCan/></Button>
          {/* Messages */}
          <div ref={messageDivRef} style={{ maxWidth: 960, minWidth: 400, flexGrow: 1, display: 'flex', fontSize: 18, flexDirection: 'column', alignItems: 'center', justifyContent: 'start', width: '100%', overflow: 'scroll', marginTop: 20, paddingLeft: 20, paddingRight: 20 }}>
            {gptMessages.map((message, index) => {
              return (
                <div key={index} style={{ display: 'flex', flexDirection: 'row', gap: 10, alignItems: 'start', marginBottom: 10, justifyContent: message.role === "user" ? "end" : 'start', width: '100%' }}>
                  {message.role === "assistant" && <div style={{ borderRadius: '50%', border: '1px solid #dddddd', padding: 5, marginTop: 10, fontSize: 25 }}><PiOpenAiLogo /></div>}

                  <div style={{ background: message.role === 'user' ? '#f4f4f4' : undefined, color: 'black', padding: 10, borderRadius: 5, whiteSpace: 'pre-wrap' }}>
                    {message.role === "assistant" && <ReactMarkdown>
                      {message.content}
                    </ReactMarkdown>}
                    {message.role === "user" && message.content}
                  </div>
                </div>
              )
            })}
          </div>

          { /* Text input */}
          <div style={{ flexGrow: 0, position: 'relative', width: '80%', maxWidth: 960, marginBottom: 20 }}>
            <Textarea
              value={textInputValue}
              onChange={(e) => setTextInputValue(e.target.value)}
              style={{ fontSize: 20, paddingRight: 40, paddingTop: 8, paddingBottom: 8 }}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  onMessageSend();
                  e.preventDefault();
                }
              }}


              minRows={1}
              placeholder="Message ChatGPT" />
            <Button isDisabled={textInputValue.length === 0} isIconOnly color={'primary'} style={{ position: 'absolute', right: 5, bottom: 5 }} size={'md'}
              onClick={onMessageSend}
            >
              <IoSend />
            </Button>
          </div>

        </div>
        {props.children}
      </div>
    </>
  )
}
