export interface IChildSidebar {
  label: string;
  id: string;
  route: string;
  icon?: any;
  active?: boolean;
}

export interface ISidebar {
  id: string;
  label: string;
  route?: string;
  startWith?: string;
  icon?: any;
  active?: boolean;
  isOpen?: boolean;
  menu?: IChildSidebar[];
}
