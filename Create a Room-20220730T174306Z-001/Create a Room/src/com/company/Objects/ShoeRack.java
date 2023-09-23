package com.company.Objects;

import com.company.Base;

import java.util.Scanner;

public class ShoeRack extends Base {
    public String object = "ShoeRack";
    public static String name = "a Shoe Rack";
    public static int position=-10;

    public static boolean shoesWorn = false;
    public static boolean slippersWorn = false;

    public static void openRack() {
        Scanner scanner = new Scanner(System.in);
        System.out.println("you have opened the shoe rack");
        System.out.println("here you can wear shoes and slippers");
        System.out.println("please wear shoes before going out of the house");
        System.out.println("type 'wear' to wear shoes or slippers");
        System.out.println("type 'take' to take off whatever you are wearing and then keep it back");
        System.out.println("type 'close' to close the shoe rack.");
        label:
        while (true) {
            switch (scanner.nextLine().toLowerCase()) {
                case "wear":
                    System.out.println("what would you like to wear.");
                    System.out.println("'slippers' or 'shoes' (please type the exact)");
                    switch (scanner.nextLine()) {
                        case "slippers":
                            wearSlipper();
                            break;
                        case "shoes":
                            wearShoes();
                            break;
                        default:
                            System.out.println("input not recognised");
                            break;
                    }
                case "take":
                    takeOff();
                    break;
                case "close":
                    break label;
                default:
                    System.out.println("input not recognised");
                    break;
            }
        }
        System.out.println("you closed the shoe rack.");
    }

    public static void wearShoes() {
        if (!shoesWorn && !slippersWorn) {
            System.out.println("you wore shoes");
            shoesWorn = true;
        } else if (!slippersWorn) {
            System.out.println("you are already wearing shoes.");
            System.out.println("please take off whatever you are wearing");
        } else {
            System.out.println("you are already wearing shoes.");
            System.out.println("please take off whatever you are wearing");
        }
    }

    public static void wearSlipper() {
        if (!shoesWorn && !slippersWorn) {
            System.out.println("you wore slippers");
            slippersWorn = true;
        }else if (!shoesWorn) {
            System.out.println("you are already wearing slippers.");
            System.out.println("please take off whatever you are wearing");
        } else {
            System.out.println("you are already wearing shoes.");
            System.out.println("please take off whatever you are wearing");
        }
    }

    public static void takeOff() {
        if (slippersWorn) {
            System.out.println("you took off slippers");
            slippersWorn = false;
        }else if (shoesWorn) {
            System.out.println("you took off shoes");
            shoesWorn = false;
        }else System.out.println("you are wearing nothing");
    }


    @Override
    public void printMap(int position) {
        this.position = position;
        Base.positionShoeRack=position;
        setHere(object,position);
        super.printMap(position);
    }
}
