"use client";
import { useState, useEffect } from 'react';
import styles from "./chat.module.css";
import ReactMarkdown from 'react-markdown';

export default function Home() {
  const [messages, setMessages] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [chatHistory, setChatHistory] = useState([]);
  const [activeChat, setActiveChat] = useState(null);
  
  const API_KEY = 'sk-vriszoxzcmjdbsoqikrbwqjqcltycylerdmhzjxxivurfzve';
  const API_MODEL = "Qwen/Qwen2.5-7B-Instruct";

  const getSystemPrompt = (role, prevMessages) => {
    const basePrompt = {
      'ux': `你是一个用户体验专家。请基于用户需求和其他设计师的意见，从用户体验角度提供具体的设计建议。
重点关注：
1. 用户交互和流程优化
2. 使用场景和用户需求分析
3. 功能布局和信息架构
4. 操作便利性和直观性

请具体说明：
- 用户痛点分析
- 交互设计方案
- 功能布局建议
- 与其他设计师方案的协调建议`,

      'industrial': `你是一个造型设计师。请基于用户需求、用户体验专家的建议，从产品造型角度提供具体的设计建议。
重点关注：
1. 产品形态和结构设计
2. 空间布局和尺寸规划
3. 功能性与美观性的平衡
4. 制造可行性

请具体说明：
- 造型设计方案
- 结构布局详细说明
- 关键尺寸和比例
- 与其他设计师方案的协调建议`,

      'cmf': `你是一个CMF设计师。请基于用户需求、用户体验专家和造型设计师的建议，从材料、颜色和工艺角度提供具体的设计建议。
重点关注��
1. 材料选择和搭配
2. 色彩规划和效果
3. 工艺可行性
4. 成本控制

请具体说明：
- 材料方案清单
- 色彩搭配方案
- 与其他设计师方案的协调建议`
    };

    // 获取之前所有的对话内容
    const previousDiscussion = prevMessages
      .filter(msg => !msg.isSent)
      .map(msg => ({
        role: "assistant",
        content: `[${msg.roleType === 'ux' ? '用户体验专家' : 
                     msg.roleType === 'industrial' ? '造型设计师' : 
                     'CMF设计师'}] ${msg.content}`
      }));

    return `${basePrompt[role]}

当前设计讨论的上下文：
${previousDiscussion.map(msg => msg.content).join('\n')}

请基于以上讨论和你的专业角度，提供详细的设计建议。你的建议应该：
1. 具体且可执行
2. 与其他设计师的建议相互呼应和补充
3. 指出潜在问题和解决方案
4. 提供明确的参数和标准

最终目标是形成一个完整、可行的设计方案。`;
  };

  // 加载历史记录
  useEffect(() => {
    const loadHistory = () => {
      const savedHistory = localStorage.getItem('chatHistory');
      if (savedHistory) {
        setChatHistory(JSON.parse(savedHistory));
      }
    };
    loadHistory();
  }, []);

  // 保存新的对话到历史记录
  const saveToHistory = (messages) => {
    const newChat = {
      id: Date.now(),
      title: messages[0]?.content || '新对话',
      date: new Date().toLocaleString(),
      messages: messages
    };

    setChatHistory(prev => {
      const updated = [newChat, ...prev];
      localStorage.setItem('chatHistory', JSON.stringify(updated));
      return updated;
    });
  };

  // 加载历史对话
  const loadChat = (chat) => {
    setActiveChat(chat.id);
    setMessages(chat.messages);
  };

  // 开始新对话
  const startNewChat = () => {
    setActiveChat(null);
    setMessages([]);
  };

  const sendMessage = async () => {
    const messageInput = document.getElementById('message-input');
    const content = messageInput.value.trim();
    if (content && !isLoading) {
      setIsLoading(true);
      
      try {
        // 解析用户消息，检查是否指定专家
        const roleMatch = content.match(/^@(ux|industrial|cmf)\s+(.+)$/i);
        const targetRoles = roleMatch 
          ? [roleMatch[1].toLowerCase()] // 如果指定了专家，只请求该专家回答
          : ['ux', 'industrial', 'cmf']; // 否则三位专家都回答
        
        const actualContent = roleMatch ? roleMatch[2] : content;

        // 添加用户消息到界面
        setMessages(prev => [...prev, { content, isSent: true }]);
        
        // 清空输入框
        messageInput.value = '';

        // 添加所有目标角色的空消息框
        const roleMessages = targetRoles.map(role => ({
          id: Date.now() + Math.random(),
          content: '',
          isSent: false,
          roleType: role
        }));
        
        setMessages(prev => [...prev, ...roleMessages]);

        // 依次获取每个角色的回复
        for (let i = 0; i < targetRoles.length; i++) {
          const role = targetRoles[i];
          const currentMessage = roleMessages[i];

          console.log(`Sending request for ${role}...`);

          // 调用API获取响应
          const response = await fetch('https://api.siliconflow.cn/v1/chat/completions', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${API_KEY}`
            },
            body: JSON.stringify({
              model: API_MODEL,
              messages: [
                {
                  role: "system",
                  content: getSystemPrompt(role, messages)
                },
                {
                  role: "user",
                  content: actualContent // 使用处理后的实际内容
                }
              ],
              stream: true,
              temperature: 0.7,
              max_tokens: 2000
            })
          });

          if (!response.ok) {
            throw new Error(`API request failed with status ${response.status}`);
          }

          // 处理流式响应
          const reader = response.body.getReader();
          const decoder = new TextDecoder();
          let aiResponse = '';

          while (true) {
            const { done, value } = await reader.read();
            if (done) break;

            const chunk = decoder.decode(value);
            console.log(`Received chunk for ${role}:`, chunk);

            const lines = chunk.split('\n');

            for (const line of lines) {
              if (line.startsWith('data: ')) {
                const data = line.slice(6);
                if (data === '[DONE]') continue;

                try {
                  const parsed = JSON.parse(data);
                  const content = parsed.choices[0]?.delta?.content || '';
                  aiResponse += content;

                  // 更新对应角色的消息内容
                  setMessages(prev => prev.map(msg => 
                    msg.id === currentMessage.id
                      ? { ...msg, content: aiResponse }
                      : msg
                  ));
                } catch (e) {
                  console.error(`Error parsing response for ${role}:`, e);
                }
              }
            }
          }

          console.log(`Completed response for ${role}`);
        }

        // 只有在所有专家都回复完后，才生成总结
        if (targetRoles.length > 1) {
          await generateSolutionSummary();
        }
        
        // 保存到历史记录
        saveToHistory([...messages, ...roleMessages]);
        
      } catch (error) {
        console.error('Error in sendMessage:', error);
        setMessages(prev => [...prev, { 
          content: "抱歉，发生了一些错误。请稍后重试。", 
          isSent: false,
          id: Date.now()
        }]);
      } finally {
        setIsLoading(false);
      }
    }
  };

  const generateSolutionSummary = async () => {
    if (messages.length === 0) return;

    const summaryPrompt = `作为方案专家，请总结三位设计师的讨论，形成一个完整的设计方案。请按以下格式输出：

## 设计方案总结
1. 设计风格：[简要描述设计风格特点]
2. 功能特性：[列出主要功能点]
3. 造型与结构：[描述产品形态和结构特点]
4. 色彩和材质：[说明色彩搭配和材质选择]

## 设计提示词
[将以上方案转化为简洁的英文关键词，用逗号分隔，包含风格、功能、结构、材质、色彩等要素]

请基于以下讨论内容进行总结：
${messages.map(msg => 
  !msg.isSent ? `[${msg.roleType === 'ux' ? '用户体验专家' : 
    msg.roleType === 'industrial' ? '造型设计师' : 
    'CMF设计师'}] ${msg.content}` : ''
).filter(Boolean).join('\n\n')}`;

    try {
      const response = await fetch('https://api.siliconflow.cn/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${API_KEY}`
        },
        body: JSON.stringify({
          model: API_MODEL,
          messages: [
            {
              role: "system",
              content: "你是一个经验丰富的设计方案专家，善于整合各方意见并提炼关键设计要素。"
            },
            {
              role: "user",
              content: summaryPrompt
            }
          ],
          stream: true,
          temperature: 0.7,
          max_tokens: 2000
        })
      });

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let summaryContent = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        const chunk = decoder.decode(value);
        const lines = chunk.split('\n');

        for (const line of lines) {
          if (line.startsWith('data: ')) {
            const data = line.slice(6);
            if (data === '[DONE]') continue;

            try {
              const parsed = JSON.parse(data);
              const content = parsed.choices[0]?.delta?.content || '';
              summaryContent += content;

              setMessages(prev => {
                const existingSummary = prev.find(msg => msg.roleType === 'summary');
                if (existingSummary) {
                  return prev.map(msg => 
                    msg.roleType === 'summary' ? { ...msg, content: summaryContent } : msg
                  );
                } else {
                  return [...prev, { 
                    id: Date.now(),
                    content: summaryContent, 
                    isSent: false, 
                    roleType: 'summary'
                  }];
                }
              });
            } catch (e) {
              console.error('解析响应数据失败:', e);
            }
          }
        }
      }
    } catch (error) {
      console.error('生成总结时出错:', error);
    }
  };

  return (
    <div className={styles.container}>
      <div className={styles.sidebar}>
        <div className={styles.sidebarHeader}>
          <h3>历史记录</h3>
        </div>
        <div className={styles.historyList}>
          <div 
            className={`${styles.historyItem} ${!activeChat ? styles.active : ''}`}
            onClick={startNewChat}
          >
            <div className={styles.historyItemTitle}>开始新对话</div>
          </div>
          {chatHistory.map(chat => (
            <div
              key={chat.id}
              className={`${styles.historyItem} ${chat.id === activeChat ? styles.active : ''}`}
              onClick={() => loadChat(chat)}
            >
              <div className={styles.historyItemTitle}>{chat.title}</div>
              <div className={styles.historyItemDate}>{chat.date}</div>
            </div>
          ))}
        </div>
      </div>

      <div className={styles.chatContainer}>
        <div className={styles.chatHeader}>
          <h2>CoDesign Lab</h2>
          <p className={styles.headerTip}>
            提示：输入 @ux、@industrial 或 @cmf 来指定专家回答
          </p>
        </div>

        <div className={styles.chatMessages}>
          {messages.map((message, index) => (
            <div
              key={index}
              className={`${styles.message} ${
                message.isSent ? styles.sent : styles.received
              } ${message.roleType === 'summary' ? styles.summary : ''}`}
              data-role={message.roleType}
            >
              {!message.isSent && (
                <div className={styles.messageRole}>
                  {message.roleType === 'ux' ? '用户体验专家' : 
                   message.roleType === 'industrial' ? '造型设计师' : 
                   message.roleType === 'cmf' ? 'CMF设计师' :
                   message.roleType === 'summary' ? '方案专家' : '用户'}
                </div>
              )}
              <div className={styles.messageContent}>
                <ReactMarkdown>{message.content}</ReactMarkdown>
              </div>
            </div>
          ))}
        </div>

        <div className={styles.chatInput}>
          <input 
            type="text" 
            id="message-input" 
            placeholder="输入消息..." 
            disabled={isLoading}
            onKeyPress={(e) => {
              if (e.key === 'Enter' && !isLoading) {
                sendMessage();
              }
            }}
          />
          <button 
            onClick={sendMessage} 
            disabled={isLoading}
            className={isLoading ? styles.loading : ''}
          >
            {isLoading ? '发送中...' : '发送'}
          </button>
        </div>
      </div>
    </div>
  );
}
