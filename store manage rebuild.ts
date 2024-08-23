import { useSyncExternalStore } from 'react';


/**
 *
 *
 *
 *
 *
 *
 */


/**
 * 实现一个自定封装的状态管理器
 * 模仿zustand 的实现
 */
export const createStore = (fun) => {

  // 给钩子函数提供设置数据的方法
  const set = (newVa: (oldState?: any) => any | any) => {


    // 判断传入的是函数还是值  返回的值 是新的对象
    const _value = typeof newVa === 'function' ? newVa(state) : newVa


    // 生成新值
    state = Object.assign({...state}, _value)

    //通知订阅者
    listeners.forEach((l) => l());
  };


  // 订阅函数就是订阅者注册的回调函数。当发布者有新的数据产生时，它会遍历所有订阅者，并依次调用它们的订阅函数。
  // 存储订阅者
  const listeners: Set<any> = new Set();


  // 获取数据的方法
  const get = (b) => state


  // 把set get 方法传给创建函数使用
  let state = fun(set, get)


  /**
   * 添加一个事件监听器，并提供一个取消订阅的机制。
   *
   * @param listener 一个不接受任何参数的函数，当事件发生时会被调用。
   * @returns 返回一个函数，调用该函数将从事件监听器列表中删除对应的监听器。
   */
  const subscribe = (listener: () => void) => {
    // 添加订阅
    listeners.add(listener)
    return () => {
      // 解除订阅
      listeners.delete(listener);
    }
  }

  const store = {
    setState: set,
    getState: get,
    subscribe,
  }


  /**
   * 使用提供的对象和处理器函数，同步外部状态，并返回处理后的状态
   *
   * @param obj 管理状态的对象，需要提供getState和subscribe方法
   * @param handler 处理状态的函数，接受当前状态并返回处理后的状态
   * @returns 返回处理后的状态值
   */
  const useHandle = (obj, handler) => {
    // 从对象中解构出getState和subscribe方法
    const {getState, subscribe} = obj

    // 返回处理后的状态
    // 使用同步外部状态的方法，订阅状态变化，并保持内部状态同步
    return useSyncExternalStore(subscribe, () => handler(getState()))
  }


  // 定义一个钩子函数useStore，用于处理与store的交互
  // 参数handler：一个处理函数，用于对store中的数据进行操作
  const useStore = (handler: any) => useHandle(store, handler)

  // 这一步是为了能在组件外使用   useStore.setState() 或者  getState()
  Object.assign(useStore, store)


  // 返回钩子函数
  return useStore

}


/**
 * 实现一个自定封装的状态管理器
 * 模仿jotai的实现
 */
interface Atom<StateType> {
  get: () => StateType,
  set: (newValue: StateType) => void,
  subscribe: (callback: (newValue: StateType) => void) => () => void,
  _subscribers: () => number;
}

type AtomGetter<StateType> = (
  get: <S>(a: Atom<S>) => S
) => StateType

export const createAtom = <StateType = any>(initialValue: StateType | AtomGetter<StateType>): Atom<StateType> => {

  //
  let stateValue = typeof initialValue === 'function' ? (null as StateType) : initialValue

  // 存储订阅者
  const listeners = new Set<(newValue: StateType) => void>()

  // 获取当前状态的函数
  const getState = () => stateValue

  // 定义一个名为set的函数，用于更新状态值并通知所有监听者
  const set = (newValue: StateType) => {
    // 更新状态的值为传入的newValue

    stateValue = newValue

    // 遍历所有监听者，并调用其回调函数，通知状态已更新
    listeners.forEach((callback) => callback(stateValue))
  }


  // 供get方法使用的订阅器 用来订阅用本函数创建的store
  const subscribed = new Set<Atom<any>>();
  // 供计算属性使用的方法 传入一个使用createStore2创建的store对象
  const get = <S>(store: Atom<S>) => {
    //保存store的值
    let currentValue = store.get()
    // 如果这个store没有被订阅过，则订阅它，并添加一个监听器，当store的状态发生变化时，更新当前状态
    if (!subscribed.has(store)) {
      subscribed.add(store);
      store.subscribe((newValue) => {
        if (currentValue === newValue) return;
        currentValue = newValue;
        computeValue();
      });
    }

    // 获取当前状态
    return currentValue
  }

  // 定义一个异步函数，用于组合其他运算的用法
  const computeValue = async () => {
    // 获取初始值，如果初始值是一个函数，则调用该函数
    // 否则直接使用初始值
    const newValue = typeof initialValue === 'function'
      ? (initialValue as AtomGetter<StateType>)(get)
      : stateValue

    // 临时清空状态值，准备存储新的状态值
    stateValue = (null as StateType);

    // 等待新的状态值计算完成，并将其赋值给stateValue
    stateValue = await newValue;

    // 遍历监听器数组，调用每个回调函数并传递新的状态值
    // 这样可以通知所有监听器状态值已经更新
    listeners.forEach((callback) => callback(stateValue));
  }

  // 初始化的时候计算一次初始值
  computeValue();


  // 返回封装后的Atom对象
  return {
    get: getState,
    set,
    subscribe: (callback) => {
      // 将回调函数添加到事件监听器中
      listeners.add(callback);
      // 返回一个函数，用于从事件监听器中删除回调函数
      return () => {
        listeners.delete(callback)
      }
    },
    _subscribers: () => listeners.size,
  }


}



/**
 * 定义一个挂载存储状态的钩子函数
 * 此钩子用于连接和操作一个外部存储系统中的状态
 *
 * @param store 一个Atom对象，代表了外部状态源
 * @returns 返回一个包含当前状态和更新状态函数的数组
 */
export const useAtom = <StateType>(store: Atom<StateType>): [StateType, (newValue: StateType) => void] => {
  // 使用同步外部存储的钩子来获取当前的状态
  const _state = useSyncExternalStore(store.subscribe, store.get)
  // 返回当前状态和一个更新状态的函数
  return [_state, store.set]
}


/**
 * 自定义钩子，用于获取指定 store 的值
 *
 * @param store Atom<S> 类型的 store，用于管理状态
 * @returns 返回 store 的当前值
 *
 */
export const useAtomValue = <S>(store: Atom<S>) => {
  return useSyncExternalStore(store.subscribe, store.get)
}





